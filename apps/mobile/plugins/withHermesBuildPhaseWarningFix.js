const { withPodfile } = require("@expo/config-plugins");

const FIX_MARKER = "PawBloom: keep the Hermes replacement phase explicitly always out of date";
const POST_INSTALL_ANCHOR = "  post_install do |installer|\n";

function addHermesBuildPhaseWarningFix(contents) {
  if (contents.includes(FIX_MARKER)) {
    return contents;
  }

  if (!contents.includes(POST_INSTALL_ANCHOR)) {
    throw new Error("Could not find the iOS Podfile post_install hook for the Hermes warning fix.");
  }

  const fix = `${POST_INSTALL_ANCHOR}    # ${FIX_MARKER}\n    installer.pods_project.targets.each do |target|\n      next unless target.name == 'hermes-engine'\n\n      target.shell_script_build_phases.each do |phase|\n        next unless phase.name.include?('[Hermes] Replace Hermes for the right configuration')\n\n        phase.always_out_of_date = '1'\n      end\n    end\n\n`;

  return contents.replace(POST_INSTALL_ANCHOR, fix);
}

module.exports = function withHermesBuildPhaseWarningFix(config) {
  return withPodfile(config, (podfileConfig) => {
    podfileConfig.modResults.contents = addHermesBuildPhaseWarningFix(
      podfileConfig.modResults.contents,
    );
    return podfileConfig;
  });
};

module.exports.addHermesBuildPhaseWarningFix = addHermesBuildPhaseWarningFix;
