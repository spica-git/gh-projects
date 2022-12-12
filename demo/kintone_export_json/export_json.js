"use strict"

{
	if (!window.spica) { window.spica = {} }
	window.spica.ExportJson = {
		Fields: {},
		AppProp: {}
	}

	const CO = {};
	CO.BQType = {
		integer: "INTEGER",
		float: "FLOAT",
		timestamp: "TIMESTAMP",
		date: "DATE",
		string: "STRING",
		record: "RECORD",
		array: "STRING",
	};

	CO.BYMode = {
		required: "REQUIRED",
		nullable: "NULLABLE",
		repeated: "REPEATED"
	};

	CO.TypeMap = {
		NUMBER: { type: 'number', bqtype: CO.BQType.float, mode: CO.BYMode.nullable },
		CALC: { type: 'number', bqtype: CO.BQType.float, mode: CO.BYMode.nullable },

		CREATED_TIME: { type: 'date', bqtype: CO.BQType.timestamp, mode: CO.BYMode.nullable },
		UPDATED_TIME: { type: 'date', bqtype: CO.BQType.timestamp, mode: CO.BYMode.nullable },
		DATETIME: { type: 'date', bqtype: CO.BQType.timestamp, mode: CO.BYMode.nullable },
		DATE: { type: 'date', bqtype: CO.BQType.date, mode: CO.BYMode.nullable },

		RECORD_NUMBER: { type: 'str', bqtype: CO.BQType.string, mode: CO.BYMode.required },
		SINGLE_LINE_TEXT: { type: 'str', bqtype: CO.BQType.string, mode: CO.BYMode.nullable },
		DROP_DOWN: { type: 'str', bqtype: CO.BQType.string, mode: CO.BYMode.nullable },
		RADIO_BUTTON: { type: 'str', bqtype: CO.BQType.string, mode: CO.BYMode.nullable },
		LINK: { type: 'str', bqtype: CO.BQType.string, mode: CO.BYMode.nullable },
		MULTI_LINE_TEXT: { type: 'str', bqtype: CO.BQType.string, mode: CO.BYMode.nullable },
		RICH_TEXT: { type: 'str', bqtype: CO.BQType.string, mode: CO.BYMode.nullable },
		TIME: { type: 'str', bqtype: CO.BQType.string, mode: CO.BYMode.nullable },
		CREATOR: { type: 'str', bqtype: CO.BQType.string, mode: CO.BYMode.nullable },
		MODIFIER: { type: 'str', bqtype: CO.BQType.string, mode: CO.BYMode.nullable },

		CHECK_BOX: { type: 'list', bqtype: CO.BQType.array, mode: CO.BYMode.repeated },
		MULTI_SELECT: { type: 'list', bqtype: CO.BQType.array, mode: CO.BYMode.repeated },
		USER_SELECT: { type: 'list', bqtype: CO.BQType.array, mode: CO.BYMode.repeated },
		ORGANIZATION_SELECT: { type: 'list', bqtype: CO.BQType.array, mode: CO.BYMode.repeated },
		GROUP_SELECT: { type: 'list', bqtype: CO.BQType.array, mode: CO.BYMode.repeated },

		SUBTABLE: { type: 'table', bqtype: CO.BQType.record, mode: CO.BYMode.repeated },
	};

	$(document).ready(() => {
		kintone.api(kintone.api.url("/k/v1/app/form/fields", true), "GET", { app: kintone.app.getId() })
			.then((resp) => {
				window.spica.ExportJson.Fields = resp.properties;
				parseFields(window.spica.ExportJson.Fields, window.spica.ExportJson.AppProp);
				setEvHandler();
				buildFieldsTable(window.spica.ExportJson.AppProp)
			}).catch((err) => {
				console.error(err)
			})
	})


	function parseFields(_fields, param, subcode) {
		for (let code in _fields) {
			const field = _fields[code]
			const code_name = subcode ? `${subcode}.${code}` : code;

			if (CO.TypeMap[field["type"]]) {
				param[code_name] = CO.TypeMap[field["type"]]
			}

			if (field["type"] === "SUBTABLE") {
				parseFields(field["fields"], param, code);
			}
		}
		return param;
	}

	function buildFieldsTable(_properties) {
		const $tbody = $('#exportlayout tbody')
		let count = 1;
		for (let code_name in _properties) {
			let subtable_name = '';
			let code = '';
			let field = null;
			if (code_name.indexOf('.') !== -1) {
				const codes = code_name.split('.')
				code = codes[1];
				subtable_name = codes[0]
				field = window.spica.ExportJson.Fields[subtable_name].fields[code];
			} else {
				code = code_name;
				field = window.spica.ExportJson.Fields[code];
			}

			const $tr = $(`<tr data-ftype="${field.type}" data-code="${code}" data-codename="${code_name}" data-subtable="${subtable_name}">`)
			const $td1 = $('<td>').text(field.label)
			const $td2 = $('<td>').text(code_name)

			const $td3 = $('<td>')
			const $input = $(`<input type="text" value="_${count++}_${field.type}">`)
			$td3.append($input)
			$tr.append($td1)
			$tr.append($td2)
			$tr.append($td3)
			$tbody.append($tr)
		}
	}

	function genBqSchema() {
		const $tbody = $('#exportlayout tbody')
		const $rows = $tbody.find('[data-subtable=""]')

		const fn_parse = function ($elements, _schema) {
			$elements.each((index, tr) => {
				const $tr = $(tr)
				const col_name = $tr.find('input').val();
				const code_name = $tr.data("codename");
				const field_type = $tr.data("ftype");
				const bq_type = CO.TypeMap[field_type]

				const column = {
					name: col_name,
					type: bq_type.bqtype,
					mode: bq_type.mode
				};

				if (bq_type.mode === CO.BYMode.repeated) {
					const $co_fields = $tbody.find(`[data-subtable="${code_name}"]`)
					column.fields = fn_parse($co_fields, [])
				}
				_schema.push(column)
			})
			return _schema;
		}

		const $textarea = $('#exportarea')
		$textarea.val('')

		const schema = fn_parse($rows, []);
		const json = schema.map(dat => { return JSON.stringify(dat) }).join(",\n")
		$textarea.val(`[\n${json}\n]`)
	}

	function downloadJson(records) {
		const $tbody = $('#exportlayout tbody')
		const fn_parse_record = function (_records, _resp) {
			_records.forEach((record) => {
				const data = {}
				for (const code in record) {
					const field = record[code];
					const map = CO.TypeMap[field.type];
					const $tr = $tbody.find(`[data-code="${code}"]`)
					if (!map || $tr.length === 0) { continue; }

					const col_name = $tr.find('input').val();

					if (map.type === 'str') {
						data[col_name] = (typeof field.value === 'object') ? field.value.name : field.value;
					} else if (map.type === 'number') {
						data[col_name] = parseFloat(field.value);
					} else if (map.type === 'date') {
						data[col_name] = field.value;
					} else if (map.type === 'list') {
						data[col_name] = field.value.map(val => { return (typeof val === 'object') ? val.name : val })
					} else if (map.type === 'table') {
						data[col_name] = fn_parse_record(field.value.map(v => v.value), [])
					}

				}
				_resp.push(data)
			})

			return _resp;
		}

		const resp = fn_parse_record(records, [])
		const blob = new Blob([resp.map(v => JSON.stringify(v)).join("\n")], { type: "text/plain" });
		const $a = $('<a>')
		$('#ExportJsonWrap').append($a)
		const ele = $a[0]
		ele.href = URL.createObjectURL(blob);
		ele.download = 'export.json';
		ele.click();
	}

	function setEvHandler() {
		$('#exportschema').on('click', (e) => {
			genBqSchema()
		})
		$('#exportjson').on('click', (e) => {
			kintone.api(kintone.api.url('/k/v1/records', true), "GET", { app: kintone.app.getId() })
				.then((resp) => {
					downloadJson(resp.records)
				}).catch((err) => {
					console.error(err)
				})
		})
	}
}