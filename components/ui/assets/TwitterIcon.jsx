import React from "react";

export default function TwitterIcon({
  stroke = "currentColor",
  width = 24,
  height = 24,
  className = "",
  ...props
}) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <path
        d="M17.5 4.04184C16.75 4.41101 16.015 4.56101 15.25 4.78851C14.4092 3.83434 13.1625 3.78184 11.965 4.23268C10.3558 4.83851 10 6.27434 10 7.80351C7.56667 7.86601 5.39917 6.75184 4 4.78851C4 4.78851 0.863333 10.391 7 13.0802C5.59583 14.0193 4.19583 14.6535 2.5 14.5868C4.98083 15.946 7.685 16.4135 10.025 15.7302C13.8833 14.6043 16.1583 10.9618 16.1367 7.06601C16.1367 6.87851 17.2692 4.97768 17.5 4.04184Z"
        stroke={stroke}
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
