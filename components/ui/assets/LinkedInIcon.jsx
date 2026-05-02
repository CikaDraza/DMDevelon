import React from "react";

export default function LinkedInIcon({
  stroke = "currentColor",
  width = 24,
  height = 24,
  clasName = "",
  ...props
}) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={clasName}
      {...props}
    >
      <path
        d="M3.33366 4.99984C4.25413 4.99984 5.00033 4.25365 5.00033 3.33317C5.00033 2.4127 4.25413 1.6665 3.33366 1.6665C2.41318 1.6665 1.66699 2.4127 1.66699 3.33317C1.66699 4.25365 2.41318 4.99984 3.33366 4.99984Z"
        stroke={stroke}
        strokeWidth="1.66667"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M1.66699 7.49984H5.00033V17.4998H1.66699V7.49984ZM18.3337 17.4998H15.0003V11.6665C15.0003 11.2245 14.8247 10.8006 14.5122 10.488C14.1996 10.1754 13.7757 9.99984 13.3337 9.99984C12.8916 9.99984 12.4677 10.1754 12.1551 10.488C11.8426 10.8006 11.667 11.2245 11.667 11.6665V17.4998H8.33366V11.6665C8.33366 10.3404 8.86044 9.06865 9.79812 8.13097C10.7358 7.19329 12.0076 6.6665 13.3337 6.6665C14.6597 6.6665 15.9315 7.19329 16.8692 8.13097C17.8069 9.06865 18.3337 10.3404 18.3337 11.6665V17.4998Z"
        stroke={stroke}
        strokeWidth="1.66667"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
