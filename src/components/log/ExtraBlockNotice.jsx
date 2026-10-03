import React, { useEffect, useRef } from "react";

export default function ExtraBlockNotice({ onExpire }) {
  const expireRef = useRef(onExpire);
  expireRef.current = onExpire;
  useEffect(() => {
    const timer = setTimeout(() => expireRef.current(), 5000);
    return () => clearTimeout(timer);
  }, []);
  return <div className="extraBlockNotice" role="status">Extra block added</div>;
}
