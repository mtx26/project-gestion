import React from "react";

export interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary";
}

export const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  variant = "primary",
}) => (
  <button
    onClick={onClick}
    className={`btn btn-${variant}`}
    style={{
      padding: "8px 16px",
      borderRadius: "4px",
      border: "none",
      cursor: "pointer",
      backgroundColor: variant === "primary" ? "#007bff" : "#6c757d",
      color: "#fff",
      fontSize: "14px",
    }}
  >
    {children}
  </button>
);
