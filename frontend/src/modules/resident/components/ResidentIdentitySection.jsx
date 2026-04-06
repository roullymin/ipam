import React from 'react';
import { FormInput } from '../../../components/common/UI';
import { ResidentSectionHeading, ResidentSelectField } from './ResidentFormFields';

export default function ResidentIdentitySection({ formData, setFormData, typeOptions }) {
  return (
    <section>
      <ResidentSectionHeading title="人员信息" />
      <div className="grid grid-cols-2 gap-4">
        <FormInput
          label="所属公司"
          value={formData.company}
          onChange={(event) => setFormData({ ...formData, company: event.target.value })}
          required
        />
        <FormInput
          label="姓名"
          value={formData.name}
          onChange={(event) => setFormData({ ...formData, name: event.target.value })}
          required
        />
        <FormInput
          label="职务 / 岗位"
          value={formData.title}
          onChange={(event) => setFormData({ ...formData, title: event.target.value })}
        />
        <FormInput
          label="联系电话"
          value={formData.phone}
          onChange={(event) => setFormData({ ...formData, phone: event.target.value })}
          required
        />
        <FormInput
          label="邮箱"
          value={formData.email}
          onChange={(event) => setFormData({ ...formData, email: event.target.value })}
        />
        <ResidentSelectField
          label="驻场类型"
          value={formData.resident_type}
          options={typeOptions}
          onChange={(value) => setFormData({ ...formData, resident_type: value })}
        />
        <FormInput
          label="所属项目"
          value={formData.project_name}
          onChange={(event) => setFormData({ ...formData, project_name: event.target.value })}
        />
        <FormInput
          label="归属部门"
          value={formData.department}
          onChange={(event) => setFormData({ ...formData, department: event.target.value })}
        />
      </div>
    </section>
  );
}
