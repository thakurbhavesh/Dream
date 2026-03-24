import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  Grid,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  PiTranslateBold,
  PiXBold,
  PiMagnifyingGlass,
  PiCopySimpleBold,
  PiCheckBold,
  PiArrowRightBold,
} from "react-icons/pi";
import { translateText } from "../../../services/chatApi";
import { API_BASE_URL } from "../../../config/apiBaseUrl";
import { fetchWithAuth } from "../../../utils/authApi";

const FALLBACK_LANGUAGES = [
  { code: "en", name: "English", flag: "EN" },
  { code: "hi", name: "Hindi", flag: "HI" },
  { code: "es", name: "Spanish", flag: "ES" },
  { code: "fr", name: "French", flag: "FR" },
  { code: "de", name: "German", flag: "DE" },
  { code: "zh", name: "Chinese", flag: "ZH" },
  { code: "ja", name: "Japanese", flag: "JA" },
  { code: "ko", name: "Korean", flag: "KO" },
  { code: "ar", name: "Arabic", flag: "AR" },
  { code: "pt", name: "Portuguese", flag: "PT" },
  { code: "ru", name: "Russian", flag: "RU" },
  { code: "it", name: "Italian", flag: "IT" },
  { code: "bn", name: "Bengali", flag: "BN" },
  { code: "ta", name: "Tamil", flag: "TA" },
  { code: "te", name: "Telugu", flag: "TE" },
  { code: "mr", name: "Marathi", flag: "MR" },
  { code: "gu", name: "Gujarati", flag: "GU" },
  { code: "kn", name: "Kannada", flag: "KN" },
  { code: "ml", name: "Malayalam", flag: "ML" },
  { code: "pa", name: "Punjabi", flag: "PA" },
  { code: "ur", name: "Urdu", flag: "UR" },
  { code: "tr", name: "Turkish", flag: "TR" },
  { code: "th", name: "Thai", flag: "TH" },
  { code: "vi", name: "Vietnamese", flag: "VI" },
  { code: "nl", name: "Dutch", flag: "NL" },
  { code: "pl", name: "Polish", flag: "PL" },
  { code: "sv", name: "Swedish", flag: "SV" },
  { code: "uk", name: "Ukrainian", flag: "UK" },
];

const POPULAR = ["en", "hi", "es", "fr", "de", "zh", "ar", "ja", "pt", "ru"];

const TranslateDialog = ({ open, message, onClose, onTranslated }) => {
  const theme = useTheme();
  const [languages, setLanguages] = useState(FALLBACK_LANGUAGES);
  const [search, setSearch] = useState("");
  const [selectedLang, setSelectedLang] = useState(null);
  const [translating, setTranslating] = useState(false);
  const [translated, setTranslated] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const isDark = theme.palette.mode === "dark";

  const messageText = useMemo(() => {
    if (!message) return "";
    return message?.content?.text || message?.message || message?.content?.code || "";
  }, [message]);

  useEffect(() => {
    if (!open) return;
    fetchWithAuth(`${API_BASE_URL}/languages`)
      .then(({ data }) => {
        const list = data?.data || data;
        if (Array.isArray(list) && list.length) {
          setLanguages(list.map((l) => ({
            code: l.language_code || l.code || l.id,
            name: l.language_name || l.name || l.label,
            flag: (l.language_code || l.code || "").toUpperCase().slice(0, 2),
          })));
        }
      })
      .catch(() => {});
  }, [open]);

  useEffect(() => {
    if (open) {
      setSelectedLang(null);
      setTranslated("");
      setError("");
      setSearch("");
      setCopied(false);
    }
  }, [open]);

  const filteredLanguages = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return languages;
    return languages.filter((l) =>
      l.name.toLowerCase().includes(q) || l.code.toLowerCase().includes(q)
    );
  }, [languages, search]);

  const popularLanguages = useMemo(
    () => languages.filter((l) => POPULAR.includes(l.code)),
    [languages]
  );

  const handleTranslate = useCallback(async () => {
    if (!selectedLang || !messageText) return;
    setTranslating(true);
    setError("");
    setTranslated("");
    try {
      const result = await translateText(messageText, selectedLang.name);
      setTranslated(result);
      onTranslated?.({ language: selectedLang.name, translated: result });
    } catch (err) {
      setError(err?.message || "Translation failed");
    } finally {
      setTranslating(false);
    }
  }, [selectedLang, messageText, onTranslated]);

  const handleCopy = useCallback(() => {
    if (!translated) return;
    navigator.clipboard?.writeText(translated).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [translated]);

  const selectAndTranslate = useCallback((lang) => {
    setSelectedLang(lang);
    if (!messageText) return;
    setTranslating(true);
    setError("");
    setTranslated("");
    translateText(messageText, lang.name)
      .then((result) => {
        setTranslated(result);
        onTranslated?.({ language: lang.name, translated: result });
      })
      .catch((err) => setError(err?.message || "Translation failed"))
      .finally(() => setTranslating(false));
  }, [messageText, onTranslated]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      sx={{
        "& .MuiDialog-container": {
          alignItems: "center",
          justifyContent: "center",
        },
      }}
      PaperProps={{
        sx: {
          borderRadius: 3,
          bgcolor: theme.palette.background.paper,
          width: 780,
          maxWidth: "calc(100vw - 32px)",
          height: "75vh",
          maxHeight: 620,
          m: "auto",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        },
      }}
    >
      {/* Header */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ px: 2.5, py: 1.5, borderBottom: "1px solid", borderColor: "divider" }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            sx={{
              width: 36, height: 36, borderRadius: 2,
              bgcolor: alpha(theme.palette.primary.main, 0.1),
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <PiTranslateBold size={20} color={theme.palette.primary.main} />
          </Box>
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>Translate Message</Typography>
            <Typography variant="caption" color="text.secondary">
              {selectedLang ? `Translating to ${selectedLang.name}` : "Select a language below"}
            </Typography>
          </Box>
        </Stack>
        <IconButton size="small" onClick={onClose}>
          <PiXBold size={18} />
        </IconButton>
      </Stack>

      <DialogContent sx={{ p: 0, overflow: "hidden", flexGrow: 1, display: "flex", minHeight: 0 }}>
        <Stack direction={{ xs: "column", sm: "row" }} sx={{ flexGrow: 1, minHeight: 0 }}>

          {/* Left: Languages */}
          <Box
            sx={{
              width: { xs: "100%", sm: 260 },
              flexShrink: 0,
              borderRight: { sm: "1px solid" },
              borderColor: "divider",
              display: "flex",
              flexDirection: "column",
              bgcolor: isDark ? alpha(theme.palette.background.default, 0.5) : alpha(theme.palette.grey[50], 0.8),
            }}
          >
            <Box sx={{ p: 1.5 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search language..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PiMagnifyingGlass size={15} />
                    </InputAdornment>
                  ),
                  sx: { fontSize: 13, bgcolor: theme.palette.background.paper },
                }}
              />
            </Box>

            {/* Popular chips */}
            {!search && (
              <Box sx={{ px: 1.5, pb: 1, display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                {popularLanguages.map((lang) => (
                  <Chip
                    key={lang.code}
                    label={lang.name}
                    size="small"
                    onClick={() => selectAndTranslate(lang)}
                    sx={{
                      fontSize: 11,
                      height: 24,
                      bgcolor: selectedLang?.code === lang.code
                        ? alpha(theme.palette.primary.main, 0.2)
                        : alpha(theme.palette.action.hover, 0.5),
                      color: selectedLang?.code === lang.code ? "primary.main" : "text.secondary",
                      fontWeight: selectedLang?.code === lang.code ? 700 : 500,
                      "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.12) },
                    }}
                  />
                ))}
              </Box>
            )}

            {/* Language list */}
            <Box sx={{ flexGrow: 1, overflowY: "auto", overflowX: "hidden" }}>
              {filteredLanguages.map((lang) => {
                const sel = selectedLang?.code === lang.code;
                return (
                  <Stack
                    key={lang.code}
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    onClick={() => setSelectedLang(lang)}
                    sx={{
                      px: 1.5, py: 0.8,
                      cursor: "pointer",
                      bgcolor: sel ? alpha(theme.palette.primary.main, 0.12) : "transparent",
                      borderLeft: sel ? `3px solid ${theme.palette.primary.main}` : "3px solid transparent",
                      "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.06) },
                      transition: "all 0.12s",
                    }}
                  >
                    <Box
                      sx={{
                        width: 28, height: 28, borderRadius: 1,
                        bgcolor: sel ? alpha(theme.palette.primary.main, 0.15) : alpha(theme.palette.text.disabled, 0.08),
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 10, fontWeight: 800, color: sel ? "primary.main" : "text.secondary",
                      }}
                    >
                      {lang.flag || lang.code.toUpperCase().slice(0, 2)}
                    </Box>
                    <Typography variant="body2" fontWeight={sel ? 700 : 400} color={sel ? "primary.main" : "text.primary"} fontSize={13}>
                      {lang.name}
                    </Typography>
                  </Stack>
                );
              })}
              {!filteredLanguages.length && (
                <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: "center" }}>
                  No languages found
                </Typography>
              )}
            </Box>
          </Box>

          {/* Right: Message + Translation */}
          <Box sx={{ flexGrow: 1, display: "flex", flexDirection: "column", p: 2.5, overflowY: "auto", minHeight: 0 }}>

            {/* Original */}
            <Box
              sx={{
                p: 2, borderRadius: 2, mb: 2,
                bgcolor: isDark ? alpha(theme.palette.primary.main, 0.06) : "#f8fafc",
                border: "1px solid",
                borderColor: isDark ? alpha(theme.palette.primary.main, 0.15) : "#e2e8f0",
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Original
                </Typography>
                <Typography variant="caption" color="text.disabled">
                  {messageText.length} chars
                </Typography>
              </Stack>
              <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: 1.6 }}>
                {messageText || "No text to translate"}
              </Typography>
            </Box>

            {/* Translate Button */}
            <Box sx={{ display: "flex", justifyContent: "center", mb: 2 }}>
              <Button
                variant="contained"
                onClick={handleTranslate}
                disabled={!selectedLang || !messageText || translating}
                startIcon={translating ? <CircularProgress size={16} color="inherit" /> : <PiArrowRightBold size={16} />}
                sx={{
                  px: 4, py: 1, borderRadius: 2, fontWeight: 600, textTransform: "none", fontSize: 14,
                  background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark || theme.palette.primary.main})`,
                }}
              >
                {translating ? "Translating..." : selectedLang ? `Translate to ${selectedLang.name}` : "Select a language"}
              </Button>
            </Box>

            {/* Translation Result */}
            {translated ? (
              <Box
                sx={{
                  p: 2, borderRadius: 2, flexGrow: 1,
                  bgcolor: isDark ? alpha("#22c55e", 0.06) : "#f0fdf4",
                  border: "1px solid",
                  borderColor: isDark ? alpha("#22c55e", 0.2) : "#bbf7d0",
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
                      {selectedLang?.name}
                    </Typography>
                    <PiCheckBold size={12} color="#22c55e" />
                  </Stack>
                  <Button
                    size="small"
                    startIcon={copied ? <PiCheckBold size={13} /> : <PiCopySimpleBold size={13} />}
                    onClick={handleCopy}
                    sx={{ fontSize: 12, textTransform: "none", color: copied ? "#22c55e" : "text.secondary" }}
                  >
                    {copied ? "Copied!" : "Copy"}
                  </Button>
                </Stack>
                <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: 1.6 }}>
                  {translated}
                </Typography>
              </Box>
            ) : !translating && !error ? (
              <Box sx={{ flexGrow: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Typography variant="body2" color="text.disabled" sx={{ fontStyle: "italic" }}>
                  Select a language and click translate
                </Typography>
              </Box>
            ) : null}

            {/* Loading */}
            {translating && !translated ? (
              <Box sx={{ flexGrow: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 1.5 }}>
                <CircularProgress size={24} />
                <Typography variant="body2" color="text.secondary">Translating to {selectedLang?.name}...</Typography>
              </Box>
            ) : null}

            {error ? (
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.error.main, 0.08), border: "1px solid", borderColor: alpha(theme.palette.error.main, 0.2) }}>
                <Typography variant="body2" color="error">{error}</Typography>
              </Box>
            ) : null}
          </Box>
        </Stack>
      </DialogContent>
    </Dialog>
  );
};

export default TranslateDialog;
