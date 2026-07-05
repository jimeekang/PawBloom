import { getChecklistSuccessHomeNotice } from "./checklistNotice";

if (getChecklistSuccessHomeNotice() !== "") {
  throw new Error("home checklist saves must not leave a fixed notice because save feedback already appears");
}
