import assert from "node:assert/strict";
import { test } from "node:test";
import { accountTypeDisplay, accountTypeIconPx } from "../lib/account-types";

test("badge sizes map to icon pixel heights, md by default", () => {
  assert.equal(accountTypeIconPx("sm"), 16);
  assert.equal(accountTypeIconPx("md"), 20);
  assert.equal(accountTypeIconPx("lg"), 26);
  assert.equal(accountTypeIconPx(undefined), 20);
});

test("iron modes map to a label and badge icon", () => {
  assert.deepEqual(accountTypeDisplay("ironman"), {
    label: "Ironman",
    icon: "/account-types/ironman.png",
  });
  assert.deepEqual(accountTypeDisplay("hardcore_ironman"), {
    label: "Hardcore Ironman",
    icon: "/account-types/hardcore-ironman.png",
  });
  assert.deepEqual(accountTypeDisplay("ultimate_ironman"), {
    label: "Ultimate Ironman",
    icon: "/account-types/ultimate-ironman.png",
  });
  assert.deepEqual(accountTypeDisplay("group_ironman"), {
    label: "Group Ironman",
    icon: "/account-types/group-ironman.png",
  });
  assert.deepEqual(accountTypeDisplay("hardcore_group_ironman"), {
    label: "Hardcore Group Ironman",
    icon: "/account-types/hardcore-group-ironman.png",
  });
  assert.deepEqual(accountTypeDisplay("unranked_group_ironman"), {
    label: "Unranked Group Ironman",
    icon: "/account-types/unranked-group-ironman.png",
  });
});

test("normal accounts and unknown/missing modes show nothing", () => {
  assert.equal(accountTypeDisplay("normal"), null);
  assert.equal(accountTypeDisplay(undefined), null);
  assert.equal(accountTypeDisplay(null), null);
  // A future backend value this build doesn't know must degrade silently.
  assert.equal(accountTypeDisplay("some_new_mode"), null);
});
