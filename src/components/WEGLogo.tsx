interface WEGLogoProps {
  height?: number;
  color?: string;
  className?: string;
}

const WEGLogo = ({ height = 32, color = "#fff", className }: WEGLogoProps) => {
  const w = Math.round(height * 5991 / 4192);
  return (
    <svg
      viewBox="0 0 5991 4192"
      width={w}
      height={height}
      className={className}
      style={{ display: "block", shapeRendering: "geometricPrecision" }}
    >
      <polygon
        style={{ fill: color, fillRule: "nonzero" }}
        points="461,466 461,2795 922,2795 922,932 1383,932 1383,2795 1844,2795 1844,932 2304,932 2304,3261 0,3261 0,0 5991,0 5991,466"
      />
      <path
        style={{ fill: color, fillRule: "nonzero" }}
        d="M4148 2329l0 -1397 -1383 0 0 2329 1383 0 0 -466 -922 0 0 -466 922 0zm-461 -466l-461 0 0 -466 461 0 0 466z"
      />
      <path
        style={{ fill: color, fillRule: "nonzero" }}
        d="M5991 932l-1382 0 0 2329 922 0 0 466 -5531 0 0 465 5991 0 0 -3260zm-461 1863l-461 0 0 -1398 461 0 0 1398z"
      />
    </svg>
  );
};

export default WEGLogo;
