import { createLocalDiaryEntry, updateLocalDiaryEntry } from "./localDiaryState";

const created = createLocalDiaryEntry("pet-1", {
  category: "photo",
  summary: "",
  occurredAt: "10:00",
  photos: [{ uri: "file:///first.jpg" }],
});

if (created.photoCount !== 1 || created.photoUrls?.[0] !== "file:///first.jpg") {
  throw new Error("local photo diary saves must preserve displayable photo URLs");
}

const updated = updateLocalDiaryEntry(created, {
  category: "photo",
  summary: "",
  occurredAt: "10:00",
  occurredTime: "10:30",
  photos: [{ uri: "file:///second.jpg" }],
});

if (updated.photoCount !== 2 || updated.photoUrls?.join(",") !== "file:///first.jpg,file:///second.jpg") {
  throw new Error("local photo diary edits must append new photos without replacing existing photos");
}
