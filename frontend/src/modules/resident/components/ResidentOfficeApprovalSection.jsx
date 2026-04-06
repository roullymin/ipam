import React from 'react';
import { FormInput } from '../../../components/common/UI';
import { ResidentSectionHeading, ResidentSelectField } from './ResidentFormFields';

export default function ResidentOfficeApprovalSection({ formData, setFormData, approvalOptions }) {
  return (
    <section>
      <ResidentSectionHeading title="办公与审批" />
      <div className="grid grid-cols-2 gap-4">
        <FormInput
          label="驻场开始日期"
          type="date"
          value={formData.start_date || ''}
          onChange={(event) => setFormData({ ...formData, start_date: event.target.value })}
        />
        <FormInput
          label="驻场结束日期"
          type="date"
          value={formData.end_date || ''}
          onChange={(event) => setFormData({ ...formData, end_date: event.target.value })}
        />
        <FormInput
          label="办公区域"
          value={formData.office_location}
          onChange={(event) => setFormData({ ...formData, office_location: event.target.value })}
        />
        <FormInput
          label="座位号"
          value={formData.seat_number}
          onChange={(event) => setFormData({ ...formData, seat_number: event.target.value })}
        />
        <ResidentSelectField
          label="审批状态"
          value={formData.approval_status}
          options={approvalOptions}
          onChange={(value) => setFormData({ ...formData, approval_status: value })}
        />
      </div>
      <label className="mt-2 flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={!!formData.needs_seat}
          onChange={(event) => setFormData({ ...formData, needs_seat: event.target.checked })}
        />
        需要安排座位
      </label>
    </section>
  );
}
