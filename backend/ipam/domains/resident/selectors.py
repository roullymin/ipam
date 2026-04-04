def build_resident_export_rows(queryset):
    rows = []
    for index, resident in enumerate(queryset, start=1):
        devices = list(resident.devices.all())
        device_rows = devices or [None]
        for device_index, device in enumerate(device_rows):
            rows.append(
                {
                    '序号': index if device_index == 0 else '',
                    '登记编号': resident.registration_code,
                    '公司': resident.company,
                    '姓名': resident.name,
                    '职务': resident.title,
                    '联系方式': resident.phone,
                    '邮箱': resident.email,
                    '驻场类型': resident.get_resident_type_display(),
                    '所属项目': resident.project_name,
                    '归属部门': resident.department,
                    '是否需要安排座位': '是' if resident.needs_seat else '否',
                    '目前在厅办公地点': resident.office_location,
                    '座位号': resident.seat_number,
                    '驻场开始日期': resident.start_date,
                    '驻场结束日期': resident.end_date,
                    '审批状态': resident.get_approval_status_display(),
                    '设备名称': device.device_name if device else '',
                    '序列号': device.serial_number if device else '',
                    '品牌': device.brand if device else '',
                    '型号': device.model if device else '',
                    '有线网卡mac地址': device.wired_mac if device else '',
                    '无线网卡mac地址': device.wireless_mac if device else '',
                    '是否安装安全防护软件': '是' if device and device.security_software_installed else '否',
                    '操作系统是否正版激活': '是' if device and device.os_activated else '否',
                    '是否已对终端已知安全漏洞进行修补': '是' if device and device.vulnerabilities_patched else '否',
                    '最近杀毒时间': device.last_antivirus_at if device else '',
                    '是否发现病毒、木马': '是' if device and device.malware_found else '否',
                    '病毒木马说明': device.malware_notes if device else '',
                    '备注': resident.remarks if device_index == 0 else '',
                }
            )
    return rows


def build_resident_lookup_maps(grouped_rows, model):
    registration_codes = []
    companies = set()
    names = set()
    phones = set()

    for grouped in grouped_rows.values():
        resident_data = grouped['resident']
        registration_code = resident_data.get('registration_code')
        if registration_code:
            registration_codes.append(registration_code)
        companies.add(resident_data['company'])
        names.add(resident_data['name'])
        phones.add(resident_data['phone'])

    registration_map = {}
    if registration_codes:
        registration_map = {
            resident.registration_code: resident
            for resident in model.objects.filter(registration_code__in=registration_codes)
        }

    identity_map = {}
    if companies and names and phones:
        for resident in model.objects.filter(
            company__in=companies,
            name__in=names,
            phone__in=phones,
        ):
            identity_map[(resident.company, resident.name, resident.phone)] = resident

    return registration_map, identity_map
