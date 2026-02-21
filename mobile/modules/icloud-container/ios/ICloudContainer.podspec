require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'ICloudContainer'
  s.version        = package['version']
  s.summary        = 'Expo module for iCloud ubiquity container access'
  s.description    = 'Provides native access to iCloud ubiquity container paths on iOS'
  s.author         = 'Bruin'
  s.homepage       = 'https://github.com/bruin'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'
end
