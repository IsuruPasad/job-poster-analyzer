// The only error text users see: plain, non-technical, with a next step. Technical detail
// (provider messages, HTTP statuses, stack traces, Playwright call logs) goes to the browser
// console and server terminal instead, keyed by the same code shown next to the message.
import type { ExtractErrorCode, PostJobErrorCode } from "@/types/job";

const AI_NOT_SET_UP = "The AI service isn't set up correctly right now. Please contact the administrator.";

export const EXTRACT_ERROR_MESSAGES: Record<ExtractErrorCode, string> = {
  FILE_NOT_IMAGE: "This file isn't an image. Please upload a JPEG, PNG, or WebP photo of the poster.",
  UNSUPPORTED_FILE_TYPE: "This image format isn't supported. Please upload a JPEG, PNG, or WebP image.",
  FILE_TOO_LARGE: "This image is too large. Please upload a smaller image.",
  FILE_EMPTY: "This file is empty. Please choose another image.",
  FILE_UNREADABLE: "This image couldn't be opened. Please choose another image.",
  NETWORK_ERROR: "We couldn't reach the server. Please check your internet connection and try again.",
  REQUEST_TIMEOUT: "This is taking too long. Please try again.",
  BAD_SERVER_RESPONSE: "Something went wrong on our side. Please try again.",
  NOT_LOGGED_IN: "You're not logged in. Please log in, then upload the poster again.",
  SESSION_EXPIRED: "Your login has expired. Please log in again, then upload the poster again.",
  NO_IMAGE: "The image didn't upload correctly. Please try again.",
  INVALID_REQUEST: "The image didn't upload correctly. Please try again.",
  NOT_A_JOB_POSTER: "We couldn't find a job poster in this image. Please upload a clear photo of a job poster.",
  INTERNAL_ERROR: "Something went wrong while reading the poster. Please try again.",
  AI_CONFIG: AI_NOT_SET_UP,
  AI_AUTH: AI_NOT_SET_UP,
  AI_MODEL_NOT_FOUND: AI_NOT_SET_UP,
  AI_RATE_LIMIT: "The AI service is busy right now. Please wait a minute and try again.",
  AI_UNAVAILABLE: "The AI service is temporarily unavailable. Please try again in a few minutes.",
  AI_BAD_REQUEST: "The AI service couldn't read this image. Please try a different photo of the poster.",
  AI_REFUSED: "This image couldn't be processed. Please try a different poster image.",
  AI_TRUNCATED: "The AI returned an incomplete result. Please try again.",
  AI_INVALID_OUTPUT: "The AI returned an incomplete result. Please try again.",
  AI_NETWORK: "We couldn't connect to the AI service. Please try again shortly.",
  AI_TIMEOUT: "The AI service took too long to respond. Please try again.",
};

export const POST_JOB_ERROR_MESSAGES: Record<PostJobErrorCode, string> = {
  NETWORK_ERROR: "We couldn't reach the server. Please check your internet connection and try again.",
  BAD_SERVER_RESPONSE: "Something went wrong on our side. Please try again.",
  POST_INVALID_REQUEST: "The job details couldn't be sent. Please reload the page and try again.",
  POST_DISABLED: "Posting straight to ikman.lk isn't available on this site. Please post the ad on ikman.lk yourself.",
  POST_EXTENSION_MISSING: "Posting needs the ikman Job Poster browser extension. Install it in Chrome, then click Post Job again.",
  POST_EXTENSION_FAILED: "The browser extension couldn't open ikman.lk. Please reload this page and try again.",
  POST_CONFIG: "Posting to ikman.lk isn't set up correctly. Please contact the administrator.",
  POST_NOT_LOGGED_IN: "You're not logged in. Please log in again, then post the job.",
  POST_SESSION_EXPIRED: "Your ikman.lk login has expired. Please log in again, then post the job.",
  POST_AUTH_FAILED: "We couldn't sign in to ikman.lk with your account. Please log in again and retry.",
  POST_BROWSER_LAUNCH_FAILED: "The posting browser couldn't be started. Please contact the administrator.",
  POST_BROWSER_CLOSED: "The posting window was closed before the ad was finished. Click Post Job to try again.",
  POST_NAVIGATION_FAILED: "We couldn't open ikman.lk. Please check the internet connection and try again.",
  POST_LOCATION_REQUIRED: "Please choose a District and a Town before posting — ikman.lk needs a town for every job ad.",
  POST_PHONE_REQUIRED: "Please enter the Applications Receive Phone Number before posting — ikman.lk needs a phone number to receive applications.",
  POST_LOCATION_NOT_FOUND: "We couldn't select the job's location on ikman.lk. Please check the District and Town, then try again.",
  POST_TIMEOUT: "ikman.lk took too long to respond. Please try again.",
  POST_FAILED: "Something went wrong while posting the ad to ikman.lk. Please try again.",
};
