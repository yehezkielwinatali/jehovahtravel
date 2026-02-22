import { Counter } from "../models/invoiceModel.js";

export const generateInvoiceNumber = async (owner, issueDate) => {
  const date = new Date(issueDate);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const datePart = `${y}${m}${d}`;

  const counterKey = `inv-${owner}-${datePart}`;

  const counter = await Counter.findOneAndUpdate(
    { key: counterKey },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" },
  );

  const sequence = String(counter.seq).padStart(4, "0");
  return `INV-${datePart}-${sequence}`;
};
