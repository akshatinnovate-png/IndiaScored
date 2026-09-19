import type { FC } from "react";

interface ButtonProps {
  label: string;
  onClick?: () => void;
}

export const Button: FC<ButtonProps> = ({ label, onClick }) => {
  return (
    <button
      onClick={onClick}
      className="w-full max-w-sm px-8 py-4 rounded-3xl bg-gradient-to-r from-lime-400 to-green-400 text-black font-bold text-lg shadow-lg hover:shadow-xl hover:scale-105 transform transition-all duration-300 ease-out active:scale-95"
    >
      {label}
    </button>
  );
};