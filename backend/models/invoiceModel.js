import mongoose from "mongoose";

//item schema
const itemSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      default: "",
    },
    description: {
      type: String,
      required: true,
    },
    qty: {
      type: Number,
      required: true,
      default: 1,
    },
    unitPrice: {
      type: Number,
      required: true,
      default: 0,
    },
    nta: {
      type: Number,
      required: true,
      default: 0, // Harga modal per item
    },
  },
  {
    _id: false,
  },
);

// invoice schema
const invoiceSchema = new mongoose.Schema(
  {
    owner: {
      type: String,
      required: true,
      index: true,
    }, //clerk id
    //must be unique
    invoiceNumber: {
      type: String,
      required: true,
    },
    issueDate: { type: Date, required: true, default: Date.now },
    dueDate: { type: Date },

    //business info
    fromBusinessName: { type: String, default: "" },
    fromEmail: { type: String, default: "" },
    fromAddress: { type: String, default: "" },
    fromPhone: { type: String, default: "" },
    fromGst: { type: String, default: "" },

    //client info
    client: {
      name: { type: String, default: "" },
      email: { type: String, default: "" },
      address: { type: String, default: "" },
      phone: { type: String, default: "" },
    },

    items: { type: [itemSchema], default: [] },

    currency: { type: String, default: "IDR" },
    status: {
      type: String,
      enum: ["draft", "unpaid", "paid", "overdue"],
      default: "draft",
    },

    //assets handling
    logoDataUrl: { type: String, default: null },
    stampDataUrl: { type: String, default: null },
    signatureDataUrl: { type: String, default: null },

    signatureName: { type: String, default: "" },
    signatureTitle: { type: String, default: "" },
    subtotal: { type: Number, default: 0 },
    downPayment: { type: Number, default: 0 },
    totalNta: { type: Number, default: 0 }, // Tambahkan ini
    profit: { type: Number, default: 0 }, // Tambahkan ini
    total: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  },
);

invoiceSchema.index({ owner: 1, invoiceNumber: 1 }, { unique: true });
// invoiceSchema.index({
//   "client.name": "text",
//   "client.email": "text",
//   invoiceNumber: "text",
//   "items.description": "text", // Tambahkan ini agar search lebih optimal
//   "items.name": "text",
// });

const counterSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  seq: { type: Number, default: 0 },
});

const Counter =
  mongoose.models.Counter || mongoose.model("Counter", counterSchema);

export { Counter };

const Invoice =
  mongoose.models.Invoice || mongoose.model("Invoice", invoiceSchema);
export default Invoice;
