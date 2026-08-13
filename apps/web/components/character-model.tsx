"use client";

/**
 * Renders a player's exported character model.
 *
 * This one component backs both surfaces deliberately: the interactive viewer
 * on a profile, and the still that /model-image screenshots for Discord. A
 * second renderer would be a second thing to keep in sync, and the whole point
 * of the Discord image is that it shows what the website shows.
 *
 * Three.js is imported dynamically so it never lands in the bundle of a page
 * that does not draw a model — it is a large dependency for a small feature.
 */
import { useEffect, useRef, useState } from "react";

export type CharacterModelProps = {
  /** Public URL of the binary glTF to draw. */
  src: string;
  /** Optional pet model, drawn beside the player. */
  petSrc?: string | null;
  width?: number;
  height?: number;
  /** Slowly rotate. Off for the still, so the same outfit always renders identically. */
  spin?: boolean;
  /**
   * Sets `window.__modelReady` once a frame has actually been drawn. The
   * screenshot service polls that flag; without it the capture races the
   * asynchronous model load and photographs an empty canvas.
   */
  signalReady?: boolean;
};

export function CharacterModel({
  src,
  petSrc,
  width = 400,
  height = 600,
  spin = false,
  signalReady = false,
}: CharacterModelProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;

    (async () => {
      const THREE = await import("three");
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");

      const mount = mountRef.current;
      if (!mount || disposed) return;

      const scene = new THREE.Scene();

      // Transparent background: the still is composited onto a Discord embed
      // and the viewer onto a card, neither of which wants a grey box.
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height);
      renderer.setClearColor(0x000000, 0);
      mount.appendChild(renderer.domElement);

      // Flat, even lighting. Game models carry their own baked vertex colours,
      // so dramatic lighting only fights them.
      scene.add(new THREE.AmbientLight(0xffffff, 2.2));
      const key = new THREE.DirectionalLight(0xffffff, 1.1);
      key.position.set(1, 2, 3);
      scene.add(key);

      const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 5000);
      const root = new THREE.Group();
      scene.add(root);

      const loader = new GLTFLoader();

      const load = (url: string) =>
        new Promise<InstanceType<typeof THREE.Group> | null>((resolve) => {
          loader.load(
            url,
            (gltf) => resolve(gltf.scene),
            undefined,
            () => resolve(null),
          );
        });

      const [playerScene, petScene] = await Promise.all([
        load(src),
        petSrc ? load(petSrc) : Promise.resolve(null),
      ]);

      if (disposed) return;
      if (!playerScene) {
        setFailed(true);
        return;
      }

      // Game models are Y-down relative to glTF's convention, so they arrive
      // upside down without this.
      playerScene.scale.set(1, -1, 1);
      root.add(playerScene);

      if (petScene) {
        petScene.scale.set(1, -1, 1);
        const petBox = new THREE.Box3().setFromObject(petScene);
        const petSize = petBox.getSize(new THREE.Vector3());
        // Stand the pet to one side rather than inside the player.
        petScene.position.x += petSize.x + 20;
        root.add(petScene);
      }

      // Frame whatever we ended up with, so one camera works for a gnome in
      // rags and a maxed character with a two-handed sword.
      const box = new THREE.Box3().setFromObject(root);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      root.position.sub(center);

      const radius = Math.max(size.x, size.y, size.z) || 1;
      const distance = (radius / 2) / Math.tan((camera.fov * Math.PI) / 360);
      camera.position.set(0, 0, distance * 1.9);
      camera.lookAt(0, 0, 0);

      // Three-quarter view: straight on hides the weapon, side-on hides the face.
      root.rotation.y = Math.PI * 0.18;

      let frame = 0;
      let announced = false;
      const render = () => {
        if (disposed) return;
        if (spin) root.rotation.y += 0.005;
        renderer.render(scene, camera);
        frame++;
        // Announce only after a frame has actually been presented; readyState
        // and even a completed load both happen before anything is on screen.
        if (signalReady && !announced && frame > 2) {
          announced = true;
          (window as unknown as { __modelReady?: boolean }).__modelReady = true;
        }
        if (spin || frame <= 3) requestAnimationFrame(render);
      };
      render();

      cleanup = () => {
        renderer.dispose();
        if (renderer.domElement.parentNode === mount) {
          mount.removeChild(renderer.domElement);
        }
        scene.traverse((obj) => {
          const mesh = obj as unknown as {
            geometry?: { dispose: () => void };
            material?: { dispose: () => void } | { dispose: () => void }[];
          };
          mesh.geometry?.dispose();
          if (Array.isArray(mesh.material)) mesh.material.forEach((m) => m.dispose());
          else mesh.material?.dispose();
        });
      };
    })().catch(() => setFailed(true));

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [src, petSrc, width, height, spin, signalReady]);

  if (failed) {
    return (
      <div
        style={{ width, height }}
        className="text-osrs-parchment-dark/50 flex items-center justify-center text-xs"
      >
        Model unavailable
      </div>
    );
  }

  return <div ref={mountRef} style={{ width, height }} />;
}
