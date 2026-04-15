const fs = require('fs');
const path = require('path');

const files = ['EmailLoginScreen','EmailRegisterScreen','ForgotPasswordScreen','PhoneAuthScreen','OTPScreen'];
const base = 'C:\\stp\\src\\screens\\auth\\';

for (const f of files) {
  const p = path.join(base, f + '.tsx');
  let src = fs.readFileSync(p, 'utf8');

  // Add StatusBar to react-native imports
  if (!src.includes('StatusBar')) {
    src = src.replace("} from 'react-native';", "  StatusBar,\n} from 'react-native';");
  }

  // Add SB_HEIGHT constant before styles
  if (!src.includes('SB_HEIGHT')) {
    src = src.replace(
      'const styles = StyleSheet.create({',
      'const SB_HEIGHT = StatusBar.currentHeight ?? 24;\n\nconst styles = StyleSheet.create({'
    );
  }

  // Replace paddingVertical: 12 in header with paddingTop + paddingBottom
  src = src.replace(
    /paddingVertical: 12,/g,
    'paddingTop: SB_HEIGHT + 4,\n    paddingBottom: 8,'
  );

  fs.writeFileSync(p, src);
  console.log('done:', f, '| SB_HEIGHT refs:', (src.match(/SB_HEIGHT/g) || []).length);
}
