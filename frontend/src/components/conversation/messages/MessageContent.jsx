import TextMsg from "./TextMsg.jsx";
import LinkMsg from "./LinkMsg.jsx";
import MediaMsg from "./MediaMsg.jsx";
import AudioMsg from "./AudioMsg.jsx";
import FileMsg from "./FileMsg.jsx";
import CodeMsg from "./CodeMsg.jsx";
import PollMsg from "./PollMsg.jsx";
import SystemEventMsg from "./SystemEventMsg.jsx";
import GifMsg from "./GifMsg.jsx";

// Central registry that maps message types (from backend/normalizer) to
// presentational components. Keep this tiny switchboard up to date whenever a
// new message flavour is introduced.
const registry = {
  text: TextMsg,
  message: TextMsg,
  emoji: TextMsg,
  link: LinkMsg,
  url: LinkMsg,
  image: MediaMsg,
  video: MediaMsg,
  media: MediaMsg,
  file: FileMsg,
  pdf: FileMsg,
  doc: FileMsg,
  document: FileMsg,
  code: CodeMsg,
  snippet: CodeMsg,
  audio: AudioMsg,
  voice: AudioMsg,
  poll: PollMsg,
  gif: GifMsg,
  system: SystemEventMsg,
  event: SystemEventMsg,
  notice: SystemEventMsg,
};

const MessageContent = ({ message, onAction, ...rest }) => {
  const Component =
    registry[message?.type?.toLowerCase?.() ?? ""] ||
    registry[message?.content?.mimeType?.split?.("/")?.[0] ?? ""] ||
    TextMsg;
  return <Component message={message} onAction={onAction} {...rest} />;
};

export default MessageContent;
