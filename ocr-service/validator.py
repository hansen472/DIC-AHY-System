import re


def validate_field(value, rule):
    """
    根据规则校验单个字段。
    :param value: 识别出的字符串
    :param rule: {required, type, min, max, min_length, max_length, pattern, options}
    :return: (passed: bool, message: str)
    """
    value = (value or "").strip()

    if rule.get("required") and not value:
        return False, "必填项为空"

    if not value:
        return True, ""

    field_type = rule.get("type")
    if field_type == "number":
        try:
            num = float(value)
        except ValueError:
            return False, "应为数字"
        if "min" in rule and num < rule["min"]:
            return False, f"不能小于 {rule['min']}"
        if "max" in rule and num > rule["max"]:
            return False, f"不能大于 {rule['max']}"

    if field_type == "integer":
        try:
            num = int(value)
        except ValueError:
            return False, "应为整数"
        if "min" in rule and num < rule["min"]:
            return False, f"不能小于 {rule['min']}"
        if "max" in rule and num > rule["max"]:
            return False, f"不能大于 {rule['max']}"

    if field_type == "date":
        # 简单校验 yyyy-mm-dd / yyyy/mm/dd
        if not re.match(r"^\d{4}[-/]\d{1,2}[-/]\d{1,2}$", value):
            return False, "日期格式不正确"

    if "min_length" in rule and len(value) < rule["min_length"]:
        return False, f"长度不能小于 {rule['min_length']}"
    if "max_length" in rule and len(value) > rule["max_length"]:
        return False, f"长度不能大于 {rule['max_length']}"

    if "pattern" in rule:
        if not re.match(rule["pattern"], value):
            return False, "格式不匹配"

    if "options" in rule:
        if value not in rule["options"]:
            return False, f"应为 {'/'.join(rule['options'])} 之一"

    return True, ""


def validate_all(fields, rules):
    """
    :param fields: {field_name: {text, confidence}}
    :param rules: {field_name: rule}
    :return: {field_name: {text, confidence, passed, message}}
    """
    results = {}
    for name, item in fields.items():
        rule = rules.get(name, {})
        passed, message = validate_field(item.get("text", ""), rule)
        results[name] = {
            "text": item.get("text", ""),
            "confidence": item.get("confidence", 0),
            "passed": passed,
            "message": message
        }
    return results
