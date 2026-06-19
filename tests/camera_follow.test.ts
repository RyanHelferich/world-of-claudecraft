import { describe, expect, it } from 'vitest';
import { cameraIsManual, updateFollowCameraYaw, wrapAngle } from '../src/game/camera_follow';

describe('camera follow', () => {
  it('wraps angles to the shortest signed turn', () => {
    expect(wrapAngle(Math.PI * 1.5)).toBeCloseTo(-Math.PI / 2);
    expect(wrapAngle(-Math.PI * 1.5)).toBeCloseTo(Math.PI / 2);
  });

  it('camera yaw is never modified — the action camera never auto-follows character facing', () => {
    // Non-moving: no settle
    const noMove = updateFollowCameraYaw({
      camYaw: 1.0,
      interpFacing: 0.4,
      lastInterpFacing: 0.2,
      frameDt: 1 / 60,
      mouselook: false,
      moving: false,
      orbiting: false,
    });
    expect(noMove.camYaw).toBe(1.0);
    expect(noMove.lastInterpFacing).toBe(0.4);

    // Moving with a facing offset: still no settle
    const moving = updateFollowCameraYaw({
      camYaw: 0,
      interpFacing: Math.PI,
      lastInterpFacing: 0,
      frameDt: 1,
      mouselook: false,
      moving: true,
      orbiting: false,
    });
    expect(moving.camYaw).toBe(0);
    expect(moving.lastInterpFacing).toBe(Math.PI);
  });

  it('tracks facing through mouselook without changing yaw', () => {
    const next = updateFollowCameraYaw({
      camYaw: 2.0,
      interpFacing: 0.6,
      lastInterpFacing: 0.1,
      frameDt: 1 / 60,
      mouselook: true,
      moving: true,
      orbiting: false,
    });
    expect(next.camYaw).toBe(2.0);
    expect(next.lastInterpFacing).toBe(0.6);
  });

  it('camera stays fixed even when there is a large angular gap between camYaw and interpFacing', () => {
    const next = updateFollowCameraYaw({
      camYaw: Math.PI,
      interpFacing: 0,
      lastInterpFacing: 0,
      frameDt: 1 / 60,
      mouselook: false,
      moving: true,
      orbiting: false,
    });
    expect(next.camYaw).toBe(Math.PI);
  });

  it('camera stays fixed for medium facing offsets too', () => {
    const next = updateFollowCameraYaw({
      camYaw: 1.2,
      interpFacing: 0,
      lastInterpFacing: 0,
      frameDt: 1 / 60,
      mouselook: false,
      moving: true,
      orbiting: false,
    });
    expect(next.camYaw).toBe(1.2);
  });

  it('does not auto-follow while the camera drives the facing (mouse-camera move)', () => {
    // facing is slaved to camYaw this frame, so the follower must leave camYaw
    // untouched — chasing its own output is what produced the wobble.
    const next = updateFollowCameraYaw({
      camYaw: 1.0,
      interpFacing: 0.2,
      lastInterpFacing: 0.9,
      frameDt: 1 / 60,
      mouselook: false,
      moving: true,
      cameraDriven: true,
      orbiting: false,
    });
    expect(next.camYaw).toBe(1.0);
    expect(next.lastInterpFacing).toBe(0.2); // still tracked so re-coupling won't snap
  });

  it('does not follow or auto-settle while the player is actively orbit-dragging', () => {
    const next = updateFollowCameraYaw({
      camYaw: 1,
      interpFacing: 0.4,
      lastInterpFacing: 0.1,
      frameDt: 1 / 60,
      mouselook: false,
      moving: true,
      orbiting: true,
    });
    expect(next.camYaw).toBe(1);
  });

  it('camera is unaffected by click-to-move bearing changes', () => {
    const next = updateFollowCameraYaw({
      camYaw: Math.PI,
      interpFacing: 0,
      lastInterpFacing: Math.PI - 0.5,
      frameDt: 1 / 60,
      mouselook: false,
      moving: true,
      clickMoving: true,
      orbiting: false,
    });
    expect(next.camYaw).toBe(Math.PI);
  });

  it('treats mouse-camera mode as manual control even though mouselook reports false', () => {
    // Right-mouse mouselook already counts as manual; Mouse Camera mode reports
    // mouselook=false on desktop but must be folded in so it takes the same path.
    expect(cameraIsManual(true, false)).toBe(true);   // classic right-mouse mouselook
    expect(cameraIsManual(false, true)).toBe(true);   // Mouse Camera mode (always on)
    expect(cameraIsManual(true, true)).toBe(true);
    expect(cameraIsManual(false, false)).toBe(false); // classic, hands off — follow runs
  });

  it('camera always tracks drag exactly — both with and without explicit mouselook flag', () => {
    // Action camera: drag-delta is the sole input that moves camYaw; there is no
    // auto-follow that could fight the drag. Both paths must return zero drift.
    const simulate = (mouselook: boolean): number => {
      const dt = 1 / 60;
      const dragPerFrame = 0.03;
      let camYaw = Math.PI;
      let intended = Math.PI;
      let lastInterpFacing: number | null = camYaw;
      for (let f = 0; f < 90; f++) {
        camYaw += dragPerFrame;
        intended += dragPerFrame;
        const next = updateFollowCameraYaw({
          camYaw, interpFacing: camYaw, frameDt: dt, lastInterpFacing,
          mouselook, moving: true, orbiting: false,
        });
        camYaw = next.camYaw;
        lastInterpFacing = next.lastInterpFacing;
      }
      return Math.abs(wrapAngle(camYaw - intended));
    };
    expect(simulate(true)).toBeCloseTo(0, 6);
    expect(simulate(false)).toBeCloseTo(0, 6); // no longer drifts — camera is fully decoupled
  });

  it('camera yaw is unmodified regardless of click-to-move bearing jump size', () => {
    const large = updateFollowCameraYaw({
      camYaw: Math.PI,
      interpFacing: 0,
      lastInterpFacing: Math.PI - 0.5,
      frameDt: 1 / 60,
      mouselook: false,
      moving: true,
      clickMoving: true,
      orbiting: false,
    });
    const small = updateFollowCameraYaw({
      camYaw: 0.25,
      interpFacing: 0,
      lastInterpFacing: 0.3,
      frameDt: 1 / 60,
      mouselook: false,
      moving: true,
      clickMoving: true,
      orbiting: false,
    });
    expect(large.camYaw).toBe(Math.PI);
    expect(small.camYaw).toBe(0.25);
  });
});
