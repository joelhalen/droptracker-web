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
  /**
   * Fill the container's width instead of drawing at a fixed size, keeping
   * `aspect`. Opt-in, because the Discord still depends on exact pixel
   * dimensions — only the on-page viewer wants this.
   */
  responsive?: boolean;
  /** width / height, used only in responsive mode. Portrait by default. */
  aspect?: number;
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
  responsive = false,
  aspect = 260 / 390,
  spin = false,
  signalReady = false,
}: CharacterModelProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);

  // Live drawing size. A ref, not state: a resize must not tear down the scene
  // and re-download the model, which is what re-running the effect would do.
  const sizeRef = useRef({ w: width, h: height });
  const rendererRef = useRef<{ setSize: (w: number, h: number) => void } | null>(null);
  const cameraRef = useRef<{ aspect: number; updateProjectionMatrix: () => void } | null>(null);
  /** Draws one frame. Needed because the loop stops itself when `spin` is off. */
  const redrawRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!responsive) {
      sizeRef.current = { w: width, h: height };
      return;
    }
    const el = mountRef.current;
    if (!el) return;

    const apply = () => {
      const w = Math.max(1, Math.round(el.clientWidth));
      if (!w) return;
      const h = Math.max(1, Math.round(w / aspect));
      if (w === sizeRef.current.w && h === sizeRef.current.h) return;
      sizeRef.current = { w, h };
      rendererRef.current?.setSize(w, h);
      if (cameraRef.current) {
        cameraRef.current.aspect = w / h;
        cameraRef.current.updateProjectionMatrix();
      }
      // The still and the idle viewer both stop rendering once framed, so a
      // resize has to ask for the one frame that shows the new size.
      redrawRef.current?.();
    };

    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [responsive, width, height, aspect]);

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
      // Whatever the observer last measured — in responsive mode the container
      // has usually been sized before three.js finishes loading.
      const { w: w0, h: h0 } = sizeRef.current;
      renderer.setSize(w0, h0);
      renderer.setClearColor(0x000000, 0);
      rendererRef.current = renderer;
      mount.appendChild(renderer.domElement);

      // Flat, even lighting. Game models carry their own baked vertex colours,
      // so dramatic lighting only fights them.
      scene.add(new THREE.AmbientLight(0xffffff, 2.2));
      const key = new THREE.DirectionalLight(0xffffff, 1.1);
      key.position.set(1, 2, 3);
      scene.add(key);

      const camera = new THREE.PerspectiveCamera(35, w0 / h0, 0.1, 5000);
      cameraRef.current = camera;
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

      // No axis flip here: the exporter already converts to glTF's convention
      // (ModelMeshBuilder negates Y and Z when writing vertices). Flipping again
      // renders the character upside down, which is exactly what it did.
      root.add(playerScene);

      if (petScene) {
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
      redrawRef.current = () => {
        if (!disposed) renderer.render(scene, camera);
      };
      render();

      cleanup = () => {
        redrawRef.current = null;
        rendererRef.current = null;
        cameraRef.current = null;
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
    // Deliberately not keyed on width/height: in responsive mode those change
    // on every container resize, and rebuilding here would re-download the
    // model. The observer above resizes the live renderer instead.
  }, [src, petSrc, spin, signalReady]);

  // In responsive mode the box is width-driven; aspect-ratio reserves the
  // height so the card does not jump when the canvas appears.
  const boxStyle: React.CSSProperties = responsive
    ? { width: "100%", aspectRatio: String(aspect) }
    : { width, height };

  if (failed) {
    return (
      <div
        style={boxStyle}
        className="text-osrs-parchment-dark/50 flex items-center justify-center text-xs"
      >
        Model unavailable
      </div>
    );
  }

  // grid + justify-items-center keeps the canvas centred if the measured size
  // and the box ever disagree (a resize between measure and paint).
  return <div ref={mountRef} style={boxStyle} className="grid justify-items-center" />;
}
