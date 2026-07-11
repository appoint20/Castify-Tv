import React from "react";

export default function RailSkeleton({ title }) {
  return (
    <section className="mb-10 md:mb-12">
      <div className="px-6 md:px-16 mb-3">
        <div className="h-6 w-40 bg-nflix-surface rounded animate-pulse" />
      </div>
      <div className="flex gap-4 overflow-hidden px-6 md:px-16">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="shrink-0 w-[220px] md:w-[240px] aspect-video rounded-md bg-nflix-surface animate-pulse"
          />
        ))}
      </div>
    </section>
  );
}
