import { ImageSourcePropType } from "react-native";
import { RequestCategory } from "../../api/contracts";
import { getCategoryKey, getCategoryLabel } from "./requestPresentation";

const servicePersonCardImage = require("../../../assets/images/service-person-card.png");
const servicePainterImage = require("../../../assets/images/service-painter.png");
const serviceCarpenterImage = require("../../../assets/images/service-carpenter.png");
const serviceElectricianImage = require("../../../assets/images/service-electrician.png");
const servicePlumberImage = require("../../../assets/images/service-plumber.png");

export type ServiceCardDescriptor = {
  title: string;
  providerCountLabel: string;
  locationLabel: string;
  image: ImageSourcePropType;
};

function formatServiceTitle(raw: string) {
  const label = raw.trim();
  if (!label) return "Service";

  const normalized = label
    .replace(/\b(home\s*care|homecare)\b/gi, "Home care")
    .replace(/\b(plumb(?:ing|er)?)\b/gi, "Plumber")
    .replace(/\b(electrical|electrician)\b/gi, "Electrician")
    .replace(/\b(carpentry|carpenter)\b/gi, "Carpenter")
    .replace(/\b(maintenance)\b/gi, "Maintenance");

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function getServiceCardDescriptor(category: RequestCategory): ServiceCardDescriptor {
  const label = getCategoryLabel(category);
  const key = getCategoryKey(category);
  const haystack = `${label} ${key}`.toLowerCase();

  let title = formatServiceTitle(label);
  let image: ImageSourcePropType = servicePersonCardImage;

  if (/plumb/.test(haystack)) {
    title = "Plumber";
    image = servicePlumberImage;
  } else if (/elect/.test(haystack)) {
    title = "Electrician";
    image = serviceElectricianImage;
  } else if (/carpent|wood|furnitur|joiner/.test(haystack)) {
    title = "Carpenter";
    image = serviceCarpenterImage;
  } else if (/clean|house ?keep|laundry|home ?care/.test(haystack)) {
    title = "Home care";
  } else if (/paint/.test(haystack)) {
    title = "Painter";
    image = servicePainterImage;
  } else if (/ac|hvac|cool/.test(haystack)) {
    title = "AC technician";
  } else if (/market|mart|shop|store/.test(haystack)) {
    title = "Marketplace";
  } else if (/maint/.test(haystack)) {
    title = "Maintenance";
  }

  return {
    title,
    providerCountLabel: "3 service providers available",
    locationLabel: "Lagos",
    image,
  };
}
