import "server-only"

// Server-only SMS sender (TextBee). The API key must NEVER be exposed to the
// browser, so this module is server-only and reads a non-public env var. Call it
// from an API route / server action, never from a client component.
const TEXTBEE_API_KEY = process.env.TEXTBEE_API_KEY

if (!TEXTBEE_API_KEY) {
    console.warn("Missing TEXTBEE_API_KEY environment variable. SMS features will not work.")
}

export async function sendSMS(phoneNumber: string, message: string): Promise<boolean> {
    try {
        // 1. Fetch the Device ID dynamically
        const devicesResponse = await fetch("https://api.textbee.dev/api/v1/gateway/devices", {
            method: "GET",
            headers: {
                "x-api-key": TEXTBEE_API_KEY || "",
            },
        })

        if (!devicesResponse.ok) {
            throw new Error("Failed to fetch TextBee devices")
        }

        const devicesData = await devicesResponse.json()
        const deviceId = devicesData.data?.[0]?._id || devicesData[0]?._id

        if (!deviceId) {
            throw new Error("No active TextBee device found")
        }

        // 2. Send the SMS using the fetched Device ID
        const response = await fetch(`https://api.textbee.dev/api/v1/gateway/devices/${deviceId}/sendSMS`, {
            method: "POST",
            headers: {
                "x-api-key": TEXTBEE_API_KEY || "",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                recipients: [phoneNumber],
                message: message,
            }),
        })

        if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`Failed to send SMS: ${errorText}`)
        }

        return true
    } catch (error) {
        console.error("SMS Error:", error)
        return false
    }
}
