import assert from "node:assert/strict";
import { createLatestRequestGuard } from "./src/ui/latest-request.js";
import { createPagedListController } from "./src/ui/paged-list.js";

const history = createPagedListController(50);
let snapshot = history.reset(Array.from({ length: 1944 }, (_, index) => ({ id: index })));
assert.equal(snapshot.items.length, 50);
assert.equal(snapshot.visibleCount, 50);
assert.equal(snapshot.totalCount, 1944);
assert.equal(snapshot.hasMore, true);
snapshot = history.loadMore();
assert.equal(snapshot.items.length, 100);
assert.deepEqual(snapshot.items.map((item) => item.id), Array.from({ length: 100 }, (_, index) => index));

const characters = createPagedListController(50);
snapshot = characters.reset(Array.from({ length: 709 }, (_, index) => index));
assert.equal(snapshot.items.length, 50);
for (let index = 0; index < 14; index += 1) snapshot = characters.loadMore();
assert.equal(snapshot.items.length, 709);
assert.equal(snapshot.hasMore, false);
snapshot = characters.reset(Array.from({ length: 26 }, (_, index) => index));
assert.equal(snapshot.items.length, 26);
assert.equal(snapshot.hasMore, false);

const guard = createLatestRequestGuard();
const requestA = guard.begin();
const requestB = guard.begin();
assert.equal(guard.isCurrent(requestB), true);
assert.equal(guard.isCurrent(requestA), false, "late A response must not replace B");
guard.cancel();
assert.equal(guard.isCurrent(requestB), false, "closing the modal must invalidate pending responses");

console.log("UI performance control tests passed.");
