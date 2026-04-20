import { ChevronRight, Building2, Layers, Box } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export interface BreadcrumbItem {
  label: string;
  path?: string;
  onClick?: () => void;
  icon?: 'building' | 'floor' | 'room';
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

const iconMap = {
  building: Building2,
  floor: Layers,
  room: Box,
};

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  const navigate = useNavigate();

  return (
    <nav className="flex items-center gap-1 text-sm">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        const Icon = item.icon ? iconMap[item.icon] : null;
        const isClickable = !isLast && (!!item.onClick || !!item.path);

        const handleClick = () => {
          if (item.onClick) item.onClick();
          else if (item.path) navigate(item.path);
        };

        return (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && (
              <ChevronRight size={14} className="text-slate-500 shrink-0" />
            )}
            <button
              onClick={isClickable ? handleClick : undefined}
              disabled={!isClickable}
              className={[
                'flex items-center gap-1 px-1 py-0.5 rounded transition-colors',
                isLast
                  ? 'text-slate-200 font-medium cursor-default'
                  : isClickable
                    ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-700 cursor-pointer'
                    : 'text-slate-400 cursor-default',
              ].join(' ')}
            >
              {Icon && <Icon size={13} className="shrink-0" />}
              <span>{item.label}</span>
            </button>
          </span>
        );
      })}
    </nav>
  );
}
