import React, { useState } from 'react';
import {
  X,
  Home,
  Save,
  User,
  Phone,
  FileText,
  MapPin,
  Plus,
  Trash2,
  CheckCircle,
  Building,
} from 'lucide-react';
import {
  ApartmentUnit,
  UnitInfo,
  DEFAULT_PROPERTY_ADDRESS,
  INITIAL_APARTMENT_UNITS,
} from '../utils/billing';
import { PesoSymbol } from './CurrencyText';

interface UnitManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  unitInfoMap: Record<ApartmentUnit, UnitInfo>;
  onSaveUnitInfo: (updatedMap: Record<ApartmentUnit, UnitInfo>) => void;
}

export const UnitManagerModal: React.FC<UnitManagerModalProps> = ({
  isOpen,
  onClose,
  unitInfoMap,
  onSaveUnitInfo,
}) => {
  const [formData, setFormData] = useState<Record<ApartmentUnit, UnitInfo>>(unitInfoMap);
  const unitsList = Object.keys(formData);
  const [selectedUnit, setSelectedUnit] = useState<ApartmentUnit>(
    unitsList[0] || 'UNIT S1'
  );
  const [savedNotice, setSavedNotice] = useState(false);
  const [isAddingNewUnit, setIsAddingNewUnit] = useState(false);
  const [newUnitName, setNewUnitName] = useState('');
  const [newUnitAddress, setNewUnitAddress] = useState(DEFAULT_PROPERTY_ADDRESS);
  const [newUnitRent, setNewUnitRent] = useState(5000);

  if (!isOpen) return null;

  const currentInfo: UnitInfo = formData[selectedUnit] || {
    unit: selectedUnit,
    address: DEFAULT_PROPERTY_ADDRESS,
    tenantName: '',
    contactNumber: '',
    defaultMonthlyRent: 5000,
    notes: '',
  };

  const handleChange = (field: keyof UnitInfo, value: any) => {
    setFormData({
      ...formData,
      [selectedUnit]: {
        ...currentInfo,
        [field]: field === 'defaultMonthlyRent' ? Math.max(0, parseFloat(value) || 0) : value,
      },
    });
  };

  const handleCreateNewUnit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newUnitName.trim().toUpperCase();
    if (!trimmedName) {
      alert('Please enter a unit name (e.g. "UNIT D", "UNIT 101", "STUDIO 3").');
      return;
    }
    if (formData[trimmedName]) {
      alert(`Unit "${trimmedName}" already exists. Please choose a different name.`);
      return;
    }

    const newUnitObj: UnitInfo = {
      unit: trimmedName,
      address: newUnitAddress.trim() || DEFAULT_PROPERTY_ADDRESS,
      tenantName: '',
      contactNumber: '',
      defaultMonthlyRent: Math.max(0, newUnitRent),
      notes: '',
    };

    const updated = {
      ...formData,
      [trimmedName]: newUnitObj,
    };

    setFormData(updated);
    setSelectedUnit(trimmedName);
    setIsAddingNewUnit(false);
    setNewUnitName('');
    setNewUnitAddress(DEFAULT_PROPERTY_ADDRESS);
    setNewUnitRent(5000);
  };

  const handleDeleteUnit = (unitToDelete: ApartmentUnit) => {
    if (Object.keys(formData).length <= 1) {
      alert('You must keep at least one unit in your property list.');
      return;
    }

    if (
      !confirm(
        `Are you sure you want to remove ${unitToDelete}? Existing saved bills for this unit will remain in history.`
      )
    ) {
      return;
    }

    const updated = { ...formData };
    delete updated[unitToDelete];
    setFormData(updated);

    const remaining = Object.keys(updated);
    if (remaining.length > 0) {
      setSelectedUnit(remaining[0]);
    }
  };

  const handleSave = () => {
    onSaveUnitInfo(formData);
    setSavedNotice(true);
    setTimeout(() => {
      setSavedNotice(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="relative bg-white rounded-2xl w-full max-w-2xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-[#2C332B] text-white">
          <div className="flex items-center gap-2">
            <Home className="w-5 h-5 text-amber-200" />
            <div>
              <h3 className="font-semibold text-base sm:text-lg">
                Apartment Units & Property Addresses
              </h3>
              <p className="text-[11px] text-stone-300">
                Manage units, custom addresses per branch/building, and tenant profiles
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-300 hover:text-white hover:bg-stone-700/50 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Units Tabs + Add Unit Action */}
        <div className="flex items-center justify-between bg-stone-100 p-2 gap-2 border-b border-stone-200 overflow-x-auto">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {unitsList.map((u) => {
              const info = formData[u];
              const hasTenant = Boolean(info?.tenantName);
              const isSelected = selectedUnit === u && !isAddingNewUnit;
              return (
                <button
                  key={u}
                  onClick={() => {
                    setSelectedUnit(u);
                    setIsAddingNewUnit(false);
                  }}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex flex-col items-center min-w-[76px] ${
                    isSelected
                      ? 'bg-[#2C332B] text-white shadow-xs'
                      : 'bg-white text-stone-700 hover:bg-stone-50 border border-stone-200'
                  }`}
                >
                  <span>{u}</span>
                  <span
                    className={`text-[9.5px] font-normal truncate max-w-[80px] ${
                      isSelected ? 'text-amber-200' : 'text-stone-400'
                    }`}
                  >
                    {hasTenant ? info.tenantName : 'Vacant/New'}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setIsAddingNewUnit(true)}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
              isAddingNewUnit
                ? 'bg-amber-500 text-stone-900 shadow-sm'
                : 'bg-emerald-700 text-white hover:bg-emerald-800'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Unit</span>
          </button>
        </div>

        {/* Main Content Area */}
        <div className="overflow-y-auto flex-1 p-5 text-stone-800">
          {/* NEW UNIT CREATION FORM */}
          {isAddingNewUnit ? (
            <form onSubmit={handleCreateNewUnit} className="flex flex-col gap-4">
              <div className="flex items-center justify-between border-b pb-2">
                <div>
                  <h4 className="text-sm font-bold text-[#2C332B] flex items-center gap-1.5">
                    <Building className="w-4 h-4 text-emerald-700" />
                    <span>Create New Apartment Unit</span>
                  </h4>
                  <p className="text-xs text-stone-500">
                    Add a new unit with its own custom address or branch location.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddingNewUnit(false)}
                  className="text-xs text-stone-500 hover:text-stone-800 underline cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Unit Name / Identifier *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. UNIT D, UNIT 201, STUDIO 3"
                  value={newUnitName}
                  onChange={(e) => setNewUnitName(e.target.value)}
                  className="w-full text-xs font-semibold p-2.5 rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-[#2C332B] bg-stone-50 uppercase"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider">
                    Property Address on Invoice
                  </label>
                  <button
                    type="button"
                    onClick={() => setNewUnitAddress(DEFAULT_PROPERTY_ADDRESS)}
                    className="text-[11px] text-emerald-700 hover:underline font-medium cursor-pointer"
                  >
                    Use Default ({DEFAULT_PROPERTY_ADDRESS})
                  </button>
                </div>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. BATAS, SILANG, CAVITE or TAGAYTAY CITY"
                    value={newUnitAddress}
                    onChange={(e) => setNewUnitAddress(e.target.value)}
                    className="w-full text-xs font-medium pl-9 pr-3 py-2.5 rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-[#2C332B] bg-stone-50 uppercase"
                  />
                </div>
                <p className="text-[11px] text-stone-500 mt-1">
                  This address will print under CALIBARA APARTMENT on all invoices generated for this unit.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Default Monthly Rent (PHP)
                </label>
                <div className="relative">
                  <PesoSymbol className="w-3.5 h-3.5 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="number"
                    step="100"
                    min="0"
                    value={newUnitRent}
                    onChange={(e) => setNewUnitRent(parseFloat(e.target.value) || 0)}
                    className="w-full text-xs font-semibold pl-8 pr-3 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-[#2C332B] bg-stone-50"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsAddingNewUnit(false)}
                  className="px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 text-white text-xs font-bold rounded-lg hover:bg-emerald-800 transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Unit</span>
                </button>
              </div>
            </form>
          ) : (
            /* EXISTING UNIT SETTINGS FORM */
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between border-b pb-2">
                <div>
                  <h4 className="text-sm font-bold uppercase tracking-wider text-[#2C332B]">
                    Settings for {selectedUnit}
                  </h4>
                  <p className="text-xs text-stone-500">
                    Customize invoice address, default monthly rent, and tenant details.
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteUnit(selectedUnit)}
                  className="text-xs text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-2 py-1 rounded border border-rose-200 transition-colors cursor-pointer flex items-center gap-1"
                  title="Remove this unit from property list"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Delete Unit</span>
                </button>
              </div>

              {/* Property Address for this unit */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider">
                    Property Address on Invoice
                  </label>
                  <button
                    type="button"
                    onClick={() => handleChange('address', DEFAULT_PROPERTY_ADDRESS)}
                    className="text-[11px] text-emerald-700 hover:underline font-medium cursor-pointer"
                  >
                    Reset to Default ({DEFAULT_PROPERTY_ADDRESS})
                  </button>
                </div>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="e.g. BATAS, SILANG, CAVITE or TAGAYTAY CITY"
                    value={currentInfo.address || DEFAULT_PROPERTY_ADDRESS}
                    onChange={(e) => handleChange('address', e.target.value.toUpperCase())}
                    className="w-full text-xs font-medium pl-9 pr-3 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-[#2C332B] bg-stone-50"
                  />
                </div>
                <p className="text-[11px] text-stone-500 mt-1">
                  Appears as <em>"ADDRESS: {currentInfo.address || DEFAULT_PROPERTY_ADDRESS}"</em> on generated invoices for {selectedUnit}.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Current Tenant / Occupant Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="e.g. John Doe / Family Smith"
                    value={currentInfo.tenantName}
                    onChange={(e) => handleChange('tenantName', e.target.value)}
                    className="w-full text-xs font-medium pl-9 pr-3 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-[#2C332B] bg-stone-50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Contact # / Messenger
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="0917-xxx-xxxx"
                      value={currentInfo.contactNumber}
                      onChange={(e) => handleChange('contactNumber', e.target.value)}
                      className="w-full text-xs font-medium pl-9 pr-3 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-[#2C332B] bg-stone-50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Default Monthly Rent (PHP)
                  </label>
                  <div className="relative">
                    <PesoSymbol className="w-3.5 h-3.5 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="number"
                      step="100"
                      min="0"
                      placeholder="5000"
                      value={currentInfo.defaultMonthlyRent}
                      onChange={(e) => handleChange('defaultMonthlyRent', e.target.value)}
                      className="w-full text-xs font-semibold pl-8 pr-3 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-[#2C332B] bg-stone-50"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Private Landlord Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Submeter location beside stairs, AC unit installed, 1 month advance deposit"
                  value={currentInfo.notes}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  className="w-full text-xs font-medium p-2.5 rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-[#2C332B] bg-stone-50"
                />
              </div>

              {savedNotice && (
                <div className="p-2.5 bg-emerald-50 text-emerald-800 rounded-lg text-xs font-semibold text-center border border-emerald-200 flex items-center justify-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span>All unit settings & addresses saved & auto-synced!</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-stone-100 border-t border-stone-200 flex items-center justify-between">
          <span className="text-[11px] text-stone-500">
            {unitsList.length} total units configured
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-200 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#2C332B] text-white text-xs font-bold rounded-lg hover:bg-[#1E231D] transition-colors shadow-xs cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save & Sync Units</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
