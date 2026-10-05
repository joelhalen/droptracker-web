import assert from "node:assert/strict";
import { test } from "node:test";
import { activityImgUrl, proxiedBoardImg } from "../lib/activity/img-proxy";
import { externalUrl } from "../lib/activity/external-url";

// The Activity iframe's CSP only loads same-origin images. These pin how a
// shared component's absolute URLs are mapped when the embed host renders it.

test("www /img becomes the relative path nginx serves on the activity host", () => {
  assert.equal(
    activityImgUrl("https://www.droptracker.io/img/npcdb/8061.png"),
    "/img/npcdb/8061.png",
  );
  assert.equal(activityImgUrl("https://droptracker.io/img/itemdb/4151.png?v=2"), "/img/itemdb/4151.png?v=2");
});

test("B2 screenshots and other www paths go through the image proxy", () => {
  const b2 = "https://video.droptracker.io/dt_img/pb/123.png";
  assert.equal(activityImgUrl(b2), `/api/activity/board-img?u=${encodeURIComponent(b2)}`);
  const art = "https://www.droptracker.io/board-art/gielinor.png";
  assert.equal(activityImgUrl(art), `/api/activity/board-img?u=${encodeURIComponent(art)}`);
});

test("relative paths, Discord's CDN and unknown hosts pass through", () => {
  assert.equal(activityImgUrl("/img/npcdb/1.png"), "/img/npcdb/1.png");
  const avatar = "https://cdn.discordapp.com/avatars/1/abc.png";
  assert.equal(activityImgUrl(avatar), avatar);
  assert.equal(activityImgUrl("https://evil.example/x.png"), "https://evil.example/x.png");
  assert.equal(activityImgUrl(null), null);
  assert.equal(activityImgUrl(""), "");
});

test("plain http is never proxied", () => {
  assert.equal(proxiedBoardImg("http://video.droptracker.io/a.png"), "http://video.droptracker.io/a.png");
});

test("a proxied image still opens at its public address", () => {
  const b2 = "https://video.droptracker.io/dt_img/pb/123.png";
  assert.equal(externalUrl(activityImgUrl(b2)), b2);
  assert.equal(
    externalUrl(activityImgUrl("https://www.droptracker.io/img/npcdb/8061.png")),
    "https://www.droptracker.io/img/npcdb/8061.png",
  );
});
