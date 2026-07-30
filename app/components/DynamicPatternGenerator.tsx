'use client';

import { useState } from 'react';

type StaffMember = {
  staff_id: string;
  name: string;
};

export default function DynamicPatternGenerator({ staffList }: { staffList: StaffMember[] }) {
  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);

  const toggleStaff = (id: string) => {
    setSelectedStaff(prev => 
      prev.includes(id) ? prev.filter(sId => sId !== id) : [...prev, id]
    );
  };

  const handleGenerate = async () => {
    if (!startDate || !endDate || selectedStaff.length === 0) {
      alert('Please select a date range and at least one staff member.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/generate-pattern', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate, staffIds: selectedStaff }),
      });

      if (!response.ok) throw new Error('Failed to generate pattern');
      
      alert('Shifts generated successfully!');
      window.location.reload();
    } catch (error) {
      console.error(error);
      alert('Error generating shifts.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 mb-6">
      <h3 className="text-lg font-bold mb-4">Generate Custom Shift Pattern</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Start Date</label>
          <input 
            type="date" 
            value={startDate} 
            onChange={e => setStartDate(e.target.value)}
            className="mt-1 block w-full border border-gray-300 rounded-md p-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">End Date</label>
          <input 
            type="date" 
            value={endDate} 
            onChange={e => setEndDate(e.target.value)}
            className="mt-1 block w-full border border-gray-300 rounded-md p-2"
          />
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Select Staff Members</label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {staffList.map((staff) => (
            <label key={staff.staff_id} className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={selectedStaff.includes(staff.staff_id)}
                onChange={() => toggleStaff(staff.staff_id)}
                className="rounded border-gray-300 text-indigo-600"
              />
              <span className="text-sm">{staff.name}</span>
            </label>
          ))}
        </div>
      </div>

      <button
        onClick={handleGenerate}
        disabled={loading}
        className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50"
      >
        {loading ? 'Generating...' : 'Generate Roster Pattern'}
      </button>
    </div>
  );
}