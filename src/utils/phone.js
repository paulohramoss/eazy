export const PHONE_MASK_PLACEHOLDER = '+55 11 99999-9999'

const BR_COUNTRY_CODE = '55'
const MOBILE_LOCAL_DIGITS = 11
const VALID_BRAZIL_DDDS = new Set([
  '11', '12', '13', '14', '15', '16', '17', '18', '19',
  '21', '22', '24', '27', '28',
  '31', '32', '33', '34', '35', '37', '38',
  '41', '42', '43', '44', '45', '46', '47', '48', '49',
  '51', '53', '54', '55',
  '61', '62', '63', '64', '65', '66', '67', '68', '69',
  '71', '73', '74', '75', '77', '79',
  '81', '82', '83', '84', '85', '86', '87', '88', '89',
  '91', '92', '93', '94', '95', '96', '97', '98', '99',
])

const onlyDigits = (value) => String(value || '').replace(/\D/g, '')

export function normalizeBrazilMobileDigits(value) {
  const raw = String(value || '').trim()
  const digits = onlyDigits(value)
  if (!digits) return ''

  let local = digits

  if (raw.startsWith(`+${BR_COUNTRY_CODE}`) && local.startsWith(BR_COUNTRY_CODE)) {
    local = local.slice(BR_COUNTRY_CODE.length)
    if (!local) return ''
  } else if (local.length > MOBILE_LOCAL_DIGITS && local.startsWith(BR_COUNTRY_CODE)) {
    local = local.slice(BR_COUNTRY_CODE.length)
  }

  if (local.length > MOBILE_LOCAL_DIGITS && local.startsWith('0')) {
    local = local.slice(1)
  }

  return `${BR_COUNTRY_CODE}${local.slice(0, MOBILE_LOCAL_DIGITS)}`
}

export function formatBrazilMobile(value) {
  const digits = normalizeBrazilMobileDigits(value)
  if (!digits) return ''

  const local = digits.slice(BR_COUNTRY_CODE.length)
  const ddd = local.slice(0, 2)
  const firstPart = local.slice(2, 7)
  const secondPart = local.slice(7, 11)

  let formatted = `+${BR_COUNTRY_CODE}`
  if (ddd) formatted += ` ${ddd}`
  if (firstPart) formatted += ` ${firstPart}`
  if (secondPart) formatted += `-${secondPart}`

  return formatted
}

export function getBrazilMobileError(value) {
  const digits = normalizeBrazilMobileDigits(value)
  if (!digits) return ''

  const local = digits.slice(BR_COUNTRY_CODE.length)
  if (local.length < MOBILE_LOCAL_DIGITS) {
    return 'Informe DDD + celular com 9 dígitos.'
  }

  const ddd = local.slice(0, 2)
  if (!VALID_BRAZIL_DDDS.has(ddd)) {
    return 'Informe um DDD válido.'
  }

  if (local[2] !== '9') {
    return 'O celular deve começar com 9 após o DDD.'
  }

  return ''
}
