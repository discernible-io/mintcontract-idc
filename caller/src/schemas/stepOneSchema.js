import * as yup from "yup";

// Helper functions
const isCIDR = (value) => {
  const cidrRegex = /^([0-9]{1,3}\.){3}[0-9]{1,3}(\/([0-9]|[1-2][0-9]|3[0-2]))$/;
  return cidrRegex.test(value);
};

const isDN = (value) => {
  const dnRegex = /^(?:(?:CN|OU|O|L|ST|C)=[^,]+,)*(?:CN|OU|O|L|ST|C)=[^,]+$/i;
  return dnRegex.test(value);
};

const isValidISO3166List = (value) => {
  try {
    const parsed = JSON.parse(value);
    if (typeof parsed !== "object" || parsed === null) {
      return false;
    }
    const keys = Object.keys(parsed);
    if (keys.length !== 1 || !["allow", "deny"].includes(keys[0])) {
      return false;
    }
    const list = parsed[keys[0]];
    if (!Array.isArray(list)) {
      return false;
    }
    return list.every((code) => typeof code === "string" && code.length === 3);
  } catch (error) {
    return false;
  }
};

// Combined schema
export const formSchema = yup.object().shape({
  openapijsonurl: yup
    .string()
    .matches(
      /^(https?:\/\/)?(([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}|localhost)(:\d{1,5})?(\/.*)?$/i,
      "Please enter a valid subdomain URL (https:// is implicit)"
    )
    .required("Required"),
  startingDate: yup.date(),
  subjectuniqueidentifierUrl: yup
    .string()
    .matches(
      /^(https?:\/\/)?(([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}|localhost)(:\d{1,5})?(\/.*)?$/i,
      "Please enter a valid subdomain URL (https:// is implicit)"
    )
    .required("Required"),
  base58spprivateKey: yup
    .string()
    .matches(/^[1-9A-HJ-NP-Za-km-z]{86,88}$/, "Please enter a valid base58 private key")
    .required("Required"),
  accountId: yup.string().required("Required"),
});