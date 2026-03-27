import express from "express";
import cors from "cors";
import "dotenv/config";
import { clerkMiddleware } from "@clerk/express";
import { connectDB } from "./config/db.js";
import path from "path";
import invoiceRouter from "./routes/invoiceRouter.js";

const app = express();
const port = 4000;

const allowedOrigins = [
  "http://localhost:5173",
  "https://jehovahtravel.vercel.app",
];

const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.use(express.json({ limit: "20mb" }));
app.use(clerkMiddleware());
app.use(express.urlencoded({ limit: "20mb", extended: true }));

connectDB();

app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
app.use("/api/invoice", invoiceRouter);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`App is running on http://localhost:${port}`);
});
