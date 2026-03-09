# Request
The user requested the post cards to have a unified layout similar to Instagram (card width matching the photo width) and requested the location icon/button to always be visible, even if the GPS coordinates are missing from the visit data.

I updated `js/app/feed_view.js` by adding Tailwind classes `max-w-md mx-auto w-full` to the post card wrapper and changed the image container to `w-full aspect-square` so it naturally fills the post. I also removed the truthy condition that hid the location button if coordinates were null. If clicked without coordinates, the modal will gracefully show text indicating no coordinates.

Please review these visual and layout fixes.

# Modified Files
- `js/app/feed_view.js`
