import React from "react";

export default function GitHubIcon({
  stroke = "currentColor",
  width = 20,
  height = 20,
  className = "",
  ...props
}) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 20 20"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M12.5 17.5C12.5 17.5 12.5 15.6083 12.5 15C12.5 14.475 12.625 13.3667 12.0833 12.9167C13.2417 12.8083 14.15 12.4333 15 11.6667C15.85 10.9 16.25 9.74167 16.25 7.91667C16.25 6.66667 16.0417 5.83333 15.4167 5C15.6583 4.35 15.7 3.33333 15.4167 2.5C14.1167 2.5 12.9417 3.39167 12.5 3.75C12.175 3.66667 11.3917 3.33333 10 3.33333C8.60833 3.33333 7.825 3.66667 7.5 3.75C7.05833 3.39167 5.88333 2.5 4.58333 2.5C4.3 3.33333 4.34167 4.35 4.58333 5C3.95833 5.83333 3.75 6.66667 3.75 7.91667C3.75 9.74167 4.15 10.9 5 11.6667C5.85 12.4333 6.75833 12.8083 7.91667 12.9167C7.375 13.3667 7.5 14.475 7.5 15C7.5 15.6083 7.5 17.5 7.5 17.5"
        stroke={stroke}
        strokeWidth="1.66667"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7.5 15.8332C6.325 15.8332 5.13333 15.3665 4.425 14.8415C3.725 14.3165 3.51667 13.4582 2.5 12.9165"
        stroke={stroke}
        strokeWidth="1.66667"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
