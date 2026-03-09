import { Box, Typography, IconButton } from '@mui/material';
import { Close, BlockOutlined, BlurOn } from '@mui/icons-material';
import { BACKGROUND_OPTIONS, type BackgroundOption } from '@/hooks/useVirtualBackground';

interface FilterPopupProps {
  open: boolean;
  activeOptionId: string;
  onSelect: (option: BackgroundOption) => void;
  onClose: () => void;
}

export function FilterPopup({ open, activeOptionId, onSelect, onClose }: FilterPopupProps) {
  if (!open) return null;

  return (
    <>
      {/* Backdrop overlay - closes popup on click */}
      <Box
        className="fixed inset-0 z-40"
        onClick={onClose}
      />

      {/* Popup card */}
      <Box
        className="absolute z-50 rounded-xl p-5 w-[380px] max-w-[calc(100vw-32px)]"
        sx={{
          bottom: 100,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(16, 34, 22, 0.9)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          animation: 'filterPopupFadeIn 0.2s ease-out',
          '@keyframes filterPopupFadeIn': {
            from: { opacity: 0, transform: 'translateX(-50%) translateY(8px)' },
            to: { opacity: 1, transform: 'translateX(-50%) translateY(0)' },
          },
        }}
      >
        {/* Header */}
        <Box className="flex items-center justify-between mb-4">
          <Typography className="text-white font-semibold text-base">
            Background Effects
          </Typography>
          <IconButton
            onClick={onClose}
            size="small"
            sx={{ color: 'rgba(255, 255, 255, 0.6)', '&:hover': { color: '#fff' } }}
          >
            <Close fontSize="small" />
          </IconButton>
        </Box>

        {/* Options grid */}
        <Box className="grid grid-cols-3 gap-3">
          {BACKGROUND_OPTIONS.map((option) => {
            const isActive = option.id === activeOptionId;

            return (
              <Box
                key={option.id}
                role="button"
                tabIndex={0}
                aria-label={`Select background: ${option.label}`}
                onClick={() => onSelect(option)}
                onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(option); } }}
                className="cursor-pointer rounded-lg overflow-hidden transition-all"
                sx={{
                  border: isActive
                    ? '2px solid #13ec5b'
                    : '2px solid rgba(255, 255, 255, 0.1)',
                  '&:hover': {
                    filter: 'brightness(1.2)',
                  },
                }}
              >
                {/* Thumbnail area */}
                <Box
                  className="relative w-full flex items-center justify-center"
                  sx={{ height: 64, backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
                >
                  {option.mode === 'none' && (
                    <Box
                      className="w-full h-full flex items-center justify-center"
                      sx={{ backgroundColor: 'rgba(255, 255, 255, 0.08)' }}
                    >
                      <BlockOutlined sx={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: 32 }} />
                    </Box>
                  )}

                  {option.mode === 'blur' && (
                    <Box
                      className="w-full h-full flex items-center justify-center"
                      sx={{
                        background:
                          'linear-gradient(135deg, rgba(60,120,200,0.5), rgba(120,60,200,0.5), rgba(60,180,120,0.5))',
                        filter: 'blur(4px)',
                      }}
                    >
                      <BlurOn
                        sx={{
                          color: 'rgba(255, 255, 255, 0.9)',
                          fontSize: 32,
                          filter: 'blur(0px)',
                        }}
                      />
                    </Box>
                  )}

                  {option.mode === 'image' && option.thumbnail && (
                    <img
                      src={option.thumbnail}
                      alt={option.label}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  )}
                </Box>

                {/* Label */}
                <Typography
                  className="text-center py-1 text-xs"
                  sx={{
                    color: isActive
                      ? '#13ec5b'
                      : 'rgba(255, 255, 255, 0.7)',
                  }}
                >
                  {option.label}
                </Typography>
              </Box>
            );
          })}
        </Box>
      </Box>
    </>
  );
}
