import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Settings, Eye, Shield, Clock, Sliders } from 'lucide-react';

export interface SafePilotSettingsState {
  responseMode: 'concise' | 'detailed';
  autoSuggestFollowups: boolean;
  scopeDrivers: boolean;
  scopeKyc: boolean;
  scopeFraud: boolean;
  scopePayouts: boolean;
  scopeSecurity: boolean;
  dataWindow: '24h' | '7d' | '30d';
  maskPii: boolean;
  readOnlyMode: boolean;
}

const DEFAULT_SETTINGS: SafePilotSettingsState = {
  responseMode: 'concise',
  autoSuggestFollowups: false,
  scopeDrivers: true,
  scopeKyc: true,
  scopeFraud: true,
  scopePayouts: true,
  scopeSecurity: true,
  dataWindow: '24h',
  maskPii: false,
  readOnlyMode: false,
};

const STORAGE_KEY = 'safepilot_admin_settings';

export function loadSettings(): SafePilotSettingsState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch {}
  return DEFAULT_SETTINGS;
}

export function saveSettings(settings: SafePilotSettingsState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {}
}

interface SafePilotSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: SafePilotSettingsState;
  onSettingsChange: (settings: SafePilotSettingsState) => void;
}

export function SafePilotSettingsDialog({
  open,
  onOpenChange,
  settings,
  onSettingsChange,
}: SafePilotSettingsDialogProps) {
  const [localSettings, setLocalSettings] = useState<SafePilotSettingsState>(settings);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleChange = <K extends keyof SafePilotSettingsState>(
    key: K,
    value: SafePilotSettingsState[K]
  ) => {
    const newSettings = { ...localSettings, [key]: value };
    setLocalSettings(newSettings);
  };

  const handleSave = () => {
    onSettingsChange(localSettings);
    saveSettings(localSettings);
    onOpenChange(false);
  };

  const handleReset = () => {
    setLocalSettings(DEFAULT_SETTINGS);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Settings className="w-4 h-4" />
            SafePilot Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Sliders className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Response Behavior</h3>
            </div>
            
            <div className="space-y-3 pl-6">
              <div className="flex items-center justify-between">
                <Label htmlFor="response-mode" className="text-sm">
                  Response mode
                </Label>
                <RadioGroup
                  value={localSettings.responseMode}
                  onValueChange={(v) => handleChange('responseMode', v as 'concise' | 'detailed')}
                  className="flex gap-3"
                >
                  <div className="flex items-center gap-1.5">
                    <RadioGroupItem value="concise" id="concise" />
                    <Label htmlFor="concise" className="text-xs font-normal cursor-pointer">Concise</Label>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <RadioGroupItem value="detailed" id="detailed" />
                    <Label htmlFor="detailed" className="text-xs font-normal cursor-pointer">Detailed</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="auto-suggest" className="text-sm">
                  Auto-suggest follow-ups
                </Label>
                <Switch
                  id="auto-suggest"
                  checked={localSettings.autoSuggestFollowups}
                  onCheckedChange={(v) => handleChange('autoSuggestFollowups', v)}
                />
              </div>
            </div>
          </section>

          <Separator />

          <section>
            <div className="flex items-center gap-2 mb-3">
              <Eye className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Scope Control</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-3 pl-6">
              Disabled scopes will not be answered.
            </p>
            
            <div className="grid grid-cols-2 gap-2 pl-6">
              {[
                { key: 'scopeDrivers', label: 'Drivers' },
                { key: 'scopeKyc', label: 'KYC' },
                { key: 'scopeFraud', label: 'Fraud' },
                { key: 'scopePayouts', label: 'Payouts' },
                { key: 'scopeSecurity', label: 'Security' },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center gap-2">
                  <Checkbox
                    id={key}
                    checked={localSettings[key as keyof SafePilotSettingsState] as boolean}
                    onCheckedChange={(v) => handleChange(key as keyof SafePilotSettingsState, !!v as any)}
                  />
                  <Label htmlFor={key} className="text-xs cursor-pointer">{label}</Label>
                </div>
              ))}
            </div>
          </section>

          <Separator />

          <section>
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Data Window</h3>
            </div>
            
            <RadioGroup
              value={localSettings.dataWindow}
              onValueChange={(v) => handleChange('dataWindow', v as '24h' | '7d' | '30d')}
              className="flex gap-2 pl-6"
            >
              {[
                { value: '24h', label: 'Last 24h' },
                { value: '7d', label: 'Last 7 days' },
                { value: '30d', label: 'Last 30 days' },
              ].map(({ value, label }) => (
                <div key={value} className="flex items-center gap-1.5">
                  <RadioGroupItem value={value} id={`window-${value}`} />
                  <Label htmlFor={`window-${value}`} className="text-xs font-normal cursor-pointer">
                    {label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </section>

          <Separator />

          <section>
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Safety and Control</h3>
            </div>
            
            <div className="space-y-3 pl-6">
              <div className="flex items-center justify-between">
                <Label htmlFor="mask-pii" className="text-sm">
                  Mask PII in responses
                </Label>
                <Switch
                  id="mask-pii"
                  checked={localSettings.maskPii}
                  onCheckedChange={(v) => handleChange('maskPii', v)}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="read-only" className="text-sm">
                  Read-only mode
                </Label>
                <Switch
                  id="read-only"
                  checked={localSettings.readOnlyMode}
                  onCheckedChange={(v) => handleChange('readOnlyMode', v)}
                />
              </div>
            </div>
          </section>
        </div>

        <div className="flex justify-between pt-3 border-t">
          <Button variant="outline" size="sm" onClick={handleReset}>
            Reset to defaults
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave}>
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
