import dayjs from "dayjs";
import localizedFormat from "dayjs/plugin/localizedFormat";
import relativeTime from "dayjs/plugin/relativeTime";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { getUserTimezone } from "./timezone.js";

dayjs.extend(localizedFormat);
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);

export const buildContactIndex = (contacts = []) =>
  contacts.reduce((accumulator, contact) => {
    if (contact?.id) {
      accumulator[contact.id] = contact;
    }
    return accumulator;
  }, {});

export const sortOrganizationsByTabs = (organizations = []) =>
  [...organizations].sort((first, second) => {
    const firstOrder = Number.isFinite(first?.tabsOrder)
      ? first.tabsOrder
      : Number.MAX_SAFE_INTEGER;
    const secondOrder = Number.isFinite(second?.tabsOrder)
      ? second.tabsOrder
      : Number.MAX_SAFE_INTEGER;
    if (firstOrder === secondOrder) {
      return first?.name?.localeCompare(second?.name ?? "") ?? 0;
    }
    return firstOrder - secondOrder;
  });

export const getOrganizationById = (organizations = [], organizationId) =>
  organizations.find((organization) => organization.id === organizationId) ?? null;

export const flattenThreads = (organizations = []) =>
  organizations.flatMap((organization) =>
    organization?.threads?.map((thread) => ({
      ...thread,
      organizationId: organization.id,
    })) ?? []
  );

export const getThreadById = (organizations = [], threadId) =>
  flattenThreads(organizations).find((thread) => thread.id === threadId) ?? null;

export const getThreadsForOrganization = (
  organizations = [],
  organizationId,
  contactIndex = {}
) => {
  const organization = getOrganizationById(organizations, organizationId);
  if (!organization) return [];
  return (
    organization.threads?.map((thread) => ({
      ...thread,
      contact: contactIndex[thread.contactId] ?? null,
    })) ?? []
  );
};

export const formatThreadTimestamp = (isoString, now = dayjs()) => {
  const tz = getUserTimezone();
  const timestamp = dayjs(isoString).tz(tz);
  if (!timestamp.isValid()) return "";
  const nowTz = now.tz ? now.tz(tz) : now;
  const minutesDiff = nowTz.diff(timestamp, "minute");
  if (minutesDiff < 1) return "now";
  if (minutesDiff < 60) return `${minutesDiff}m`;
  const hoursDiff = nowTz.diff(timestamp, "hour");
  if (hoursDiff < 24) return timestamp.format("hh:mm A");
  const daysDiff = nowTz.diff(timestamp, "day");
  if (daysDiff < 7) return `${daysDiff}d`;
  return timestamp.format("D MMM");
};

export const buildMessageGroups = (messages = [], currentUserId) => {
  const groups = [];
  let currentGroup = null;

  messages
    .slice()
    .sort((first, second) => dayjs(first.sentAt).valueOf() - dayjs(second.sentAt).valueOf())
    .forEach((message) => {
      const sentAt = dayjs(message.sentAt);
      const dayLabel = sentAt.isSame(dayjs(), "day") ? "Today" : sentAt.format("MMMM D, YYYY");

      if (!currentGroup || currentGroup.label !== dayLabel) {
        currentGroup = {
          label: dayLabel,
          messages: [],
        };
        groups.push(currentGroup);
      }

      currentGroup.messages.push({
        ...message,
        sentAt,
        sentAtLabel: sentAt.format("hh:mm A"),
        isMine: message.authorId === currentUserId,
      });
    });

  return groups;
};

export const getDefaultOrganizationId = (organizations = []) =>
  sortOrganizationsByTabs(organizations)[0]?.id ?? null;

export const getDefaultThreadId = (organizations = [], organizationId) => {
  const threads = getThreadsForOrganization(organizations, organizationId);
  return threads[0]?.id ?? null;
};
