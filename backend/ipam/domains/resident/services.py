def parse_resident_type(value, normalize_cell):
    normalized = str(normalize_cell(value)).strip().lower()
    if normalized in {'implementation', '实施驻场', '实施', '大模型实施'}:
        return 'implementation'
    if normalized in {'operations', '运维值守', '运维', '值守'}:
        return 'operations'
    if normalized in {'vendor', '厂商支持', '厂商', '外包支持'}:
        return 'vendor'
    if normalized in {'visitor', '临时来访', '访客', '来访'}:
        return 'visitor'
    return 'implementation'


def parse_resident_approval_status(value, normalize_cell):
    normalized = str(normalize_cell(value)).strip().lower()
    if normalized in {'approved', '已通过', '通过'}:
        return 'approved'
    if normalized in {'rejected', '已驳回', '驳回'}:
        return 'rejected'
    if normalized in {'left', '已离场', '离场'}:
        return 'left'
    if normalized in {'pending', '待审核', '待审批'}:
        return 'pending'
    return 'approved'


def read_resident_import_dataframe(*, uploaded_file, read_csv_with_fallback, normalize_dataframe_text, normalize_header, pandas_module):
    name = (uploaded_file.name or '').lower()
    if name.endswith('.csv'):
        dataframe = read_csv_with_fallback(uploaded_file)
        dataframe = dataframe.dropna(how='all')
        dataframe.columns = [normalize_header(col) for col in dataframe.columns]
        return dataframe, 1

    raw = normalize_dataframe_text(pandas_module.read_excel(uploaded_file, sheet_name=0, header=None))
    raw = raw.dropna(axis=0, how='all').dropna(axis=1, how='all')
    if raw.empty:
        return pandas_module.DataFrame(), 0

    row0 = [normalize_header(value) for value in raw.iloc[0].tolist()]
    row1 = [normalize_header(value) for value in raw.iloc[1].tolist()] if len(raw.index) > 1 else []
    has_legacy_two_row_header = '设备信息' in row0 or any(
        key in row1 for key in ['序列号', '品牌', '型号', '有线网卡mac地址', '无线网卡mac地址']
    )

    if has_legacy_two_row_header and len(raw.index) > 1:
        headers = []
        for index in range(len(raw.columns)):
            secondary = row1[index] if index < len(row1) else ''
            primary = row0[index] if index < len(row0) else ''
            headers.append(secondary or primary)
        dataframe = raw.iloc[2:].copy()
        header_rows = 2
    else:
        headers = row0
        dataframe = raw.iloc[1:].copy()
        header_rows = 1

    dataframe.columns = headers
    dataframe = dataframe.loc[:, [column for column in dataframe.columns if column]]
    dataframe = dataframe.dropna(how='all')
    return dataframe, header_rows


def get_resident_row_value(row, field_name, *, header_aliases, normalize_header, normalize_cell):
    aliases = header_aliases[field_name]
    normalized_map = {normalize_header(column): column for column in row.index}
    for alias in aliases:
        column_name = normalized_map.get(normalize_header(alias))
        if column_name:
            return normalize_cell(row[column_name])
    return ''


def build_resident_import_groups(
    dataframe,
    header_rows,
    *,
    header_aliases,
    normalize_header,
    normalize_cell,
    parse_bool,
    parse_date,
):
    grouped_rows = {}
    errors = []
    failed_rows = []

    for excel_row_number, (_, row) in enumerate(dataframe.iterrows(), start=header_rows + 1):
        company = str(get_resident_row_value(row, 'company', header_aliases=header_aliases, normalize_header=normalize_header, normalize_cell=normalize_cell)).strip()
        name = str(get_resident_row_value(row, 'name', header_aliases=header_aliases, normalize_header=normalize_header, normalize_cell=normalize_cell)).strip()
        phone = str(get_resident_row_value(row, 'phone', header_aliases=header_aliases, normalize_header=normalize_header, normalize_cell=normalize_cell)).strip()
        registration_code = str(get_resident_row_value(row, 'registration_code', header_aliases=header_aliases, normalize_header=normalize_header, normalize_cell=normalize_cell)).strip()

        if not company and not name and not phone:
            continue

        if not company or not name:
            reason = '缺少必填字段：公司或姓名。'
            errors.append(f'第 {excel_row_number} 行{reason}')
            failed_rows.append(
                {
                    'row_number': excel_row_number,
                    'action': 'invalid',
                    'title': name or '未填写姓名',
                    'subtitle': company or '未填写公司',
                    'sheet': '驻场导入',
                    'reason': reason,
                }
            )
            continue

        resident_key = registration_code or f'{company}|{name}|{phone}'
        record = grouped_rows.setdefault(
            resident_key,
            {
                'resident': {
                    'registration_code': registration_code,
                    'company': company,
                    'name': name,
                    'title': str(get_resident_row_value(row, 'title', header_aliases=header_aliases, normalize_header=normalize_header, normalize_cell=normalize_cell)).strip(),
                    'phone': phone,
                    'email': str(get_resident_row_value(row, 'email', header_aliases=header_aliases, normalize_header=normalize_header, normalize_cell=normalize_cell)).strip(),
                    'resident_type': parse_resident_type(get_resident_row_value(row, 'resident_type', header_aliases=header_aliases, normalize_header=normalize_header, normalize_cell=normalize_cell), normalize_cell),
                    'project_name': str(get_resident_row_value(row, 'project_name', header_aliases=header_aliases, normalize_header=normalize_header, normalize_cell=normalize_cell)).strip(),
                    'department': str(get_resident_row_value(row, 'department', header_aliases=header_aliases, normalize_header=normalize_header, normalize_cell=normalize_cell)).strip(),
                    'needs_seat': parse_bool(get_resident_row_value(row, 'needs_seat', header_aliases=header_aliases, normalize_header=normalize_header, normalize_cell=normalize_cell)),
                    'office_location': str(get_resident_row_value(row, 'office_location', header_aliases=header_aliases, normalize_header=normalize_header, normalize_cell=normalize_cell)).strip(),
                    'seat_number': str(get_resident_row_value(row, 'seat_number', header_aliases=header_aliases, normalize_header=normalize_header, normalize_cell=normalize_cell)).strip(),
                    'start_date': parse_date(get_resident_row_value(row, 'start_date', header_aliases=header_aliases, normalize_header=normalize_header, normalize_cell=normalize_cell)),
                    'end_date': parse_date(get_resident_row_value(row, 'end_date', header_aliases=header_aliases, normalize_header=normalize_header, normalize_cell=normalize_cell)),
                    'approval_status': parse_resident_approval_status(get_resident_row_value(row, 'approval_status', header_aliases=header_aliases, normalize_header=normalize_header, normalize_cell=normalize_cell), normalize_cell),
                    'remarks': str(get_resident_row_value(row, 'remarks', header_aliases=header_aliases, normalize_header=normalize_header, normalize_cell=normalize_cell)).strip(),
                },
                'devices': [],
                'row_number': excel_row_number,
            },
        )

        device_payload = {
            'device_name': str(get_resident_row_value(row, 'device_name', header_aliases=header_aliases, normalize_header=normalize_header, normalize_cell=normalize_cell)).strip(),
            'serial_number': str(get_resident_row_value(row, 'serial_number', header_aliases=header_aliases, normalize_header=normalize_header, normalize_cell=normalize_cell)).strip(),
            'brand': str(get_resident_row_value(row, 'brand', header_aliases=header_aliases, normalize_header=normalize_header, normalize_cell=normalize_cell)).strip(),
            'model': str(get_resident_row_value(row, 'model', header_aliases=header_aliases, normalize_header=normalize_header, normalize_cell=normalize_cell)).strip(),
            'wired_mac': str(get_resident_row_value(row, 'wired_mac', header_aliases=header_aliases, normalize_header=normalize_header, normalize_cell=normalize_cell)).strip(),
            'wireless_mac': str(get_resident_row_value(row, 'wireless_mac', header_aliases=header_aliases, normalize_header=normalize_header, normalize_cell=normalize_cell)).strip(),
            'security_software_installed': parse_bool(get_resident_row_value(row, 'security_software_installed', header_aliases=header_aliases, normalize_header=normalize_header, normalize_cell=normalize_cell)),
            'os_activated': parse_bool(get_resident_row_value(row, 'os_activated', header_aliases=header_aliases, normalize_header=normalize_header, normalize_cell=normalize_cell)),
            'vulnerabilities_patched': parse_bool(get_resident_row_value(row, 'vulnerabilities_patched', header_aliases=header_aliases, normalize_header=normalize_header, normalize_cell=normalize_cell)),
            'last_antivirus_at': parse_date(get_resident_row_value(row, 'last_antivirus_at', header_aliases=header_aliases, normalize_header=normalize_header, normalize_cell=normalize_cell)),
            'malware_found': parse_bool(get_resident_row_value(row, 'malware_found', header_aliases=header_aliases, normalize_header=normalize_header, normalize_cell=normalize_cell)),
            'malware_notes': str(get_resident_row_value(row, 'malware_notes', header_aliases=header_aliases, normalize_header=normalize_header, normalize_cell=normalize_cell)).strip(),
            'remarks': '',
        }
        has_device_content = any(
            value not in ['', None, False]
            for key, value in device_payload.items()
            if key not in {'security_software_installed', 'os_activated', 'vulnerabilities_patched', 'malware_found'}
        ) or any(
            device_payload[key]
            for key in ['security_software_installed', 'os_activated', 'vulnerabilities_patched', 'malware_found']
        )
        if has_device_content:
            record['devices'].append(device_payload)

    return grouped_rows, errors, failed_rows


def build_resident_import_preview(*, grouped_rows, errors, failed_rows, build_lookup_maps, resident_model, preview_limit=20):
    preview = {
        'summary': {
            'resident_rows': 0,
            'device_rows': 0,
            'create_rows': 0,
            'update_rows': 0,
            'actionable_rows': 0,
            'invalid_rows': len(errors),
        },
        'rows': [],
        'failed_rows': list(failed_rows),
        'warnings': [],
        'errors': list(errors),
        'can_import': not errors,
    }

    if not grouped_rows:
        preview['errors'].append('没有解析到有效人员，请检查模板表头和必填字段。')
        preview['failed_rows'].append(
            {
                'row_number': '',
                'action': 'invalid',
                'title': '未解析到有效人员',
                'subtitle': '驻场导入',
                'sheet': '驻场导入',
                'reason': '没有解析到有效人员，请检查模板表头和必填字段。',
            }
        )
        preview['can_import'] = False
        return preview

    registration_map, identity_map = build_lookup_maps(grouped_rows, resident_model)

    for grouped in grouped_rows.values():
        resident_data = grouped['resident']
        row_number = grouped['row_number']
        device_count = len(grouped['devices'])
        registration_code = resident_data.get('registration_code')

        resident = None
        match_reason = '按公司、姓名和联系电话匹配'
        if registration_code:
            resident = registration_map.get(registration_code)
            match_reason = '按登记编号匹配'
        if resident is None:
            resident = identity_map.get((resident_data['company'], resident_data['name'], resident_data['phone']))

        action = 'update' if resident else 'create'
        preview['summary']['resident_rows'] += 1
        preview['summary']['device_rows'] += device_count
        preview['summary'][f'{action}_rows'] += 1
        preview['summary']['actionable_rows'] += 1

        if not registration_code:
            warning = f'第 {row_number} 行未提供登记编号，预览将按公司、姓名和联系电话匹配。'
            if warning not in preview['warnings']:
                preview['warnings'].append(warning)

        if len(preview['rows']) < preview_limit:
            preview['rows'].append(
                {
                    'row_number': row_number,
                    'title': resident_data['name'],
                    'subtitle': f"{resident_data['company']} · {resident_data['phone'] or '未填写电话'}",
                    'action': action,
                    'reason': f"{match_reason}，备案设备 {device_count} 台",
                    'sheet': ' / '.join(
                        [
                            resident_data['project_name'] or '未填写项目',
                            resident_data['department'] or '未填写部门',
                        ]
                    ),
                }
            )

    return preview
