import PropTypes from 'prop-types';
import ThemeRtlLayout from './ThemeRtlLayout';
import ThemeColorPresets from './ThemeColorPresets';
import ThemeLocalization from './ThemeLocalization.jsx';

// ----------------------------------------------------------------------

ThemeSettings.propTypes = {
  children: PropTypes.node.isRequired,
};

export default function ThemeSettings({ children }) {
  return (
    <ThemeColorPresets>
        <ThemeLocalization>
          <ThemeRtlLayout>
            {children}
            {/* <SettingsDrawer /> */}
          </ThemeRtlLayout>
        </ThemeLocalization>
    </ThemeColorPresets>
  );
}
