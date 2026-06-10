import React from 'react';

const StatFilterStrip = ({
  items = [],
  isActive = () => false,
  onSelect = () => {},
  className = ''
}) => {
  const gapRem = 0.375;
  const baseColumns = 4;
  const cardWidth = items.length > 0
    ? `calc((100% - ${(baseColumns - 1) * gapRem}rem) / ${baseColumns})`
    : '0px';

  return (
    <div className={`overflow-x-auto scrollbar-hide px-1 ${className}`}>
      <div className="flex gap-1.5 min-w-full snap-x snap-mandatory">
        {items.map((item) => {
          const active = isActive(item);
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelect(item)}
              className={`flex-none rounded-xl border p-1.5 text-center transition-all duration-200 flex flex-col items-center justify-center snap-start ${
                item.color
              } ${
                active
                  ? 'border-slate-400 ring-2 ring-slate-200 shadow-inner'
                  : 'border-slate-100 hover:shadow-sm'
              }`}
              style={{
                width: cardWidth,
                minWidth: cardWidth
              }}
            >
              <div className="type-page-title leading-tight">{item.val}</div>
              <div className="type-utility uppercase mt-0.5 whitespace-nowrap">{item.label}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default StatFilterStrip;
