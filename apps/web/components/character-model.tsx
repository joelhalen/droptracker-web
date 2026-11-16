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

import { frameCharacter } from "@/lib/character-framing";

/** Space between the player and their pet, as a fraction of the player's height. */
const PET_GAP = 0.1;

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
   * asynchronous model load and photographs an empty canvas. Also sets
   * `window.__modelSize` to the canvas's `[width, height]`, because the frame
   * grows for a model that needs the room and the capture has to follow it.
   */
  signalReady?: boolean;
};

/**
 * `width`, `height` and `aspect` describe the BASE frame: what a lone
 * character is drawn in. Every character is drawn at the same scale, so a
 * model that does not fit (a scythe, a banner, a pet) gets a bigger canvas
 * rather than a smaller character; see lib/character-framing.ts. At a fixed
 * size the element itself grows. In responsive mode the box keeps the
 * container's width and the canvas hangs over both sides of it, centred, so
 * the character stays where the layout put it; only extra height reflows.
 */

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

  // How much bigger than the base frame the canvas is. State for the box the
  // layout reserves, a ref for the sizing below.
  const [grow, setGrow] = useState({ x: 1, y: 1 });
  const growRef = useRef(grow);

  // Live sizes. Refs, not state: a resize must not tear down the scene and
  // re-download the model, which is what re-running the effect would do.
  /** The base frame, in px. */
  const baseRef = useRef({ w: width, h: height });
  /** The canvas: the base frame times `grow`. */
  const sizeRef = useRef({ w: width, h: height });
  const rendererRef = useRef<{ setSize: (w: number, h: number) => void } | null>(null);
  const cameraRef = useRef<{ aspect: number; updateProjectionMatrix: () => void } | null>(null);
  /** Draws one frame. Needed because the loop stops itself when `spin` is off. */
  const redrawRef = useRef<(() => void) | null>(null);

  /** Sizes the canvas from the base frame and the growth; a no-op if unchanged. */
  const fitCanvas = useRef(() => {
    const w = Math.max(1, Math.round(baseRef.current.w * growRef.current.x));
    const h = Math.max(1, Math.round(baseRef.current.h * growRef.current.y));
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
  }).current;

  useEffect(() => {
    if (!responsive) {
      baseRef.current = { w: width, h: height };
      fitCanvas();
      return;
    }
    const el = mountRef.current;
    if (!el) return;

    const apply = () => {
      const w = Math.round(el.clientWidth);
      if (!w) return;
      baseRef.current = { w, h: w / aspect };
      fitCanvas();
    };

    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [responsive, width, height, aspect, fitCanvas]);

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
      renderer.domElement.style.flexShrink = "0";
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
        // Both models are exported standing on their own origin, so as loaded
        // the pet is inside the player. Stand it just clear of the player's
        // side, measured from the two boxes rather than by a fixed distance:
        // the exporter scales each model's node to tiles (1/128), so a constant
        // is in the wrong unit. A fixed 20 here put every pet twenty tiles
        // away, and framing both shrank the player to a speck.
        const playerBox = new THREE.Box3().setFromObject(playerScene);
        const petBox = new THREE.Box3().setFromObject(petScene);
        const gap = (playerBox.max.y - playerBox.min.y) * PET_GAP;
        const offset = playerBox.max.x - petBox.min.x + gap;
        // Either side of root's origin, which is what the model turns about:
        // the pair revolves together instead of the pet orbiting the player.
        playerScene.position.x = -offset / 2;
        petScene.position.x = offset / 2;
        root.add(petScene);
      }

      // Three-quarter view: straight on hides the weapon, side-on hides the face.
      const turn = Math.PI * 0.18;

      // One scale for every character, and a frame that grows for whatever
      // they hold: the camera stays where a lone player fills the base frame,
      // looking at the middle of a standing body, and the canvas gets wider or
      // taller when the model would not fit. Measured before the turn is
      // applied: the model stands on its own origin, which is the axis it
      // turns about and the ground it stands on.
      const box = new THREE.Box3().setFromObject(root);
      const framing = frameCharacter(
        box,
        baseRef.current.w / baseRef.current.h,
        turn,
        spin,
      );
      root.position.y = -framing.lookAtY;
      root.rotation.y = turn;
      camera.fov = framing.fov;
      camera.position.set(0, 0, framing.distance);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
      growRef.current = { x: framing.growX, y: framing.growY };
      setGrow(growRef.current);
      fitCanvas();

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
          const page = window as unknown as { __modelReady?: boolean; __modelSize?: number[] };
          page.__modelSize = [sizeRef.current.w, sizeRef.current.h];
          page.__modelReady = true;
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
  }, [src, petSrc, spin, signalReady, fitCanvas]);

  // In responsive mode the box is width-driven; aspect-ratio reserves the
  // height so the card does not jump when the canvas appears. A grown frame
  // adds height to the box, but its extra width hangs outside it.
  const boxStyle: React.CSSProperties = responsive
    ? { width: "100%", aspectRatio: String(aspect / grow.y) }
    : { width: Math.round(width * grow.x), height: Math.round(height * grow.y) };

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

  // Centred flex, with a canvas that may not shrink: when the canvas is wider
  // than the box (a grown frame) it hangs over both sides equally. A grid
  // would widen its track to the canvas and hang it all off the right.
  return <div ref={mountRef} style={boxStyle} className="flex items-start justify-center" />;
}
