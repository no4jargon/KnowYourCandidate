import { Check } from 'lucide-react';

export function ThankYouScreen() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 max-w-md w-full text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-6">
          <Check className="w-8 h-8 text-green-600" />
        </div>
        
        <h2 className="mb-4">Test Submitted Successfully</h2>
        
        <p className="text-gray-600 mb-6">
          Thank you for completing the assessment. Your responses have been recorded and will be reviewed by the hiring team.
        </p>
        
        <div className="bg-gray-50 rounded-lg p-4 text-gray-600">
          You may now close this window
        </div>
      </div>
    </div>
  );
}
