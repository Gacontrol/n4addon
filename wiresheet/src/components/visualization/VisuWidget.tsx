import React from 'react';
import {
  VisuWidget as VisuWidgetType,
  SwitchConfig,
  ButtonConfig,
  SliderConfig,
  IncrementerConfig,
  InputConfig,
  GaugeConfig,
  DisplayConfig,
  LedConfig,
  BarConfig,
  LabelConfig,
  TankConfig,
  ThermometerConfig
} from '../../types/visualization';
import {
  VisuSwitch,
  VisuButton,
  VisuSlider,
  VisuIncrementer,
  VisuInput,
  VisuGauge,
  VisuDisplay,
  VisuLed,
  VisuBar,
  VisuTank,
  VisuThermometer,
  VisuLabel
} from './index';

interface VisuWidgetProps {
  widget: VisuWidgetType;
  value: unknown;
  onValueChange: (value: unknown) => void;
  isEditMode: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onDoubleClick: () => void;
}

export const VisuWidgetRenderer: React.FC<VisuWidgetProps> = ({
  widget,
  value,
  onValueChange,
  isEditMode,
  isSelected,
  onSelect,
  onDoubleClick
}) => {
  const renderWidget = () => {
    switch (widget.type) {
      case 'visu-switch':
        return (
          <VisuSwitch
            value={Boolean(value)}
            onChange={onValueChange}
            config={widget.config as SwitchConfig}
            style={widget.style}
            label={widget.label}
            disabled={isEditMode}
          />
        );

      case 'visu-button':
        return (
          <VisuButton
            onValueChange={onValueChange}
            config={widget.config as ButtonConfig}
            style={widget.style}
            label={widget.label}
            disabled={isEditMode}
          />
        );

      case 'visu-slider':
        return (
          <VisuSlider
            value={typeof value === 'number' ? value : 0}
            onChange={(v) => onValueChange(v)}
            config={widget.config as SliderConfig}
            style={widget.style}
            label={widget.label}
            disabled={isEditMode}
            width={widget.size.width - 20}
          />
        );

      case 'visu-incrementer':
        return (
          <VisuIncrementer
            value={typeof value === 'number' ? value : 0}
            onChange={(v) => onValueChange(v)}
            config={widget.config as IncrementerConfig}
            style={widget.style}
            label={widget.label}
            disabled={isEditMode}
          />
        );

      case 'visu-input':
        return (
          <VisuInput
            value={value as number | string}
            onChange={(v) => onValueChange(v)}
            config={widget.config as InputConfig}
            style={widget.style}
            label={widget.label}
            disabled={isEditMode}
          />
        );

      case 'visu-gauge':
        return (
          <VisuGauge
            value={typeof value === 'number' ? value : 0}
            config={widget.config as GaugeConfig}
            style={widget.style}
            label={widget.label}
            size={widget.size}
          />
        );

      case 'visu-display':
        return (
          <VisuDisplay
            value={value as number | string | boolean | null}
            config={widget.config as DisplayConfig}
            style={widget.style}
            label={widget.label}
          />
        );

      case 'visu-led':
        return (
          <VisuLed
            value={Boolean(value)}
            config={widget.config as LedConfig}
            style={widget.style}
            label={widget.label}
          />
        );

      case 'visu-bar':
        return (
          <VisuBar
            value={typeof value === 'number' ? value : 0}
            config={widget.config as BarConfig}
            style={widget.style}
            label={widget.label}
            size={widget.size}
          />
        );

      case 'visu-tank':
        return (
          <VisuTank
            value={typeof value === 'number' ? value : 0}
            config={widget.config as TankConfig}
            style={widget.style}
            label={widget.label}
            size={widget.size}
          />
        );

      case 'visu-thermometer':
        return (
          <VisuThermometer
            value={typeof value === 'number' ? value : 0}
            config={widget.config as ThermometerConfig}
            style={widget.style}
            label={widget.label}
            size={widget.size}
          />
        );

      case 'visu-label':
        return (
          <VisuLabel
            config={widget.config as LabelConfig}
            style={widget.style}
          />
        );

      default:
        return <div className="text-red-400">Unbekannter Widget-Typ</div>;
    }
  };

  return (
    <div
      className={`absolute flex items-center justify-center ${isEditMode ? 'cursor-move' : ''}`}
      style={{
        left: widget.position.x,
        top: widget.position.y,
        width: widget.size.width,
        height: widget.size.height,
        zIndex: widget.zIndex || 1,
        backgroundColor: widget.style.backgroundColor,
        borderRadius: widget.style.borderRadius || 8,
        border: isSelected ? '2px solid #3b82f6' : widget.style.borderColor ? `1px solid ${widget.style.borderColor}` : 'none',
        padding: 8
      }}
      onClick={(e) => {
        if (isEditMode) {
          e.stopPropagation();
          onSelect();
        }
      }}
      onDoubleClick={(e) => {
        if (isEditMode) {
          e.stopPropagation();
          onDoubleClick();
        }
      }}
    >
      {renderWidget()}
      {isEditMode && isSelected && (
        <>
          <div className="absolute -top-1 -left-1 w-3 h-3 bg-blue-500 rounded-full cursor-nw-resize" />
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full cursor-ne-resize" />
          <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-blue-500 rounded-full cursor-sw-resize" />
          <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-500 rounded-full cursor-se-resize" />
        </>
      )}
    </div>
  );
};
