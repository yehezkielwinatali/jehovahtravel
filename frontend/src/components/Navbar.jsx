import { useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { useClerk } from "@clerk/clerk-react";
import logo from "../assets/logo.png";

const Home = () => {
  const { isSignedIn } = useAuth();
  const clerk = useClerk();
  const navigate = useNavigate();

  // Redirect kalau sudah login
  useEffect(() => {
    if (isSignedIn) {
      navigate("/app/dashboard", { replace: true });
    }
  }, [isSignedIn, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-gray-950 via-gray-900 to-black text-white">
      <div className="text-center space-y-8">
        {/* Logo */}
        <div className="flex justify-center">
          <img
            src={logo}
            alt="Logo"
            className="w-100 h-40 object-contain drop-shadow-2xl"
          />
        </div>

        {/* Title */}
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-wide">
            Selamat Datang
          </h1>
          <p className="text-gray-400 text-sm">
            Tolong sign-in atau daftar untuk mengelola invoice
          </p>
        </div>

        {/* Buttons */}
        <div className="flex justify-center gap-4 pt-4">
          <button
            onClick={() => clerk.openSignIn()}
            className="px-6 py-2 rounded-lg border border-gray-600 hover:bg-gray-800 transition-all duration-300"
          >
            Sign In
          </button>

          <button
            onClick={() => clerk.openSignUp()}
            className="px-6 py-2 rounded-lg bg-white text-black font-medium hover:scale-105 transition-all duration-300"
          >
            Daftar
          </button>
        </div>
      </div>
    </div>
  );
};

export default Home;
