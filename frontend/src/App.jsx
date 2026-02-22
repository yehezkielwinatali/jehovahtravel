import Home from "./pages/Home";
import { Routes, Route } from "react-router-dom";
import { RedirectToSignIn, SignedIn, SignedOut } from "@clerk/clerk-react";
import AppShell from "./components/AppShell";
import Dashboard from "./pages/Dashboard";
import CreateInvoice from "./pages/CreateInvoice";
import InvoicePreview from "./components/InvoicePreview";
import Invoices from "./pages/Invoices";
import "./index.css";
const ClerkProtected = ({ children }) => (
  <>
    <SignedIn>{children}</SignedIn>
    <SignedOut>
      <RedirectToSignIn />
    </SignedOut>
  </>
);

const App = () => {
  return (
    <div className="min-h-screen max-w-full overflow-x-hidden">
      <Routes>
        <Route path="/" element={<Home />} />
        {/* <Route must be Protected by Clerk */}
        <Route
          path="/app"
          element={
            <ClerkProtected>
              <AppShell />
            </ClerkProtected>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="invoices" element={<Invoices />} />
          <Route path="invoices/new" element={<CreateInvoice />} />
          <Route path="invoices/:id" element={<InvoicePreview />} />
          <Route path="invoices/:id/preview" element={<InvoicePreview />} />
          <Route path="invoices/:id/edit" element={<CreateInvoice />} />
          <Route path="create-invoice" element={<CreateInvoice />} />
        </Route>
      </Routes>
    </div>
  );
};

export default App;
