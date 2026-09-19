import React from "react";

const Navbar = () => {
  return (
    <nav className="flex items-center justify-between p-4 bg-white shadow-md">
      <h1 className="text-xl font-bold text-dark">BharatLoan</h1>
      <button className="px-4 py-2 bg-primary text-dark rounded-lg font-semibold">
        Get Started
      </button>
    </nav>
  );
};

export default Navbar;
