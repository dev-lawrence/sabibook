import Image from "next/image";
import type { ReactNode } from "react";

/** A plain phone outline: dark bezel, rounded screen, no shadow. Set the width with a max-w class. Screenshots are 390 x 844. */
export function PhoneFrame({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`w-full rounded-[2.75rem] bg-ink p-2.5 ${className}`}>
      <div className="relative aspect-[390/844] overflow-hidden rounded-[2.25rem] bg-paper">{children}</div>
    </div>
  );
}

/** One screenshot. The incoming screen fades in on top; the outgoing one drops out once it is covered. */
function Screen({ src, alt, visible = true, eager }: { src: string; alt: string; visible?: boolean; eager?: boolean }) {
  return (
    <Image
      src={src}
      alt={visible ? alt : ""}
      aria-hidden={!visible}
      fill
      sizes="300px"
      loading={eager ? "eager" : "lazy"}
      className={`object-cover object-top transition-opacity ease-out motion-reduce:transition-none ${
        visible ? "z-10 opacity-100 duration-500" : "z-0 opacity-0 delay-500 duration-0"
      }`}
    />
  );
}

PhoneFrame.Screen = Screen;
