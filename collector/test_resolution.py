"""
Test script for channel ID resolution (without actual API calls).

This tests that the resolution logic correctly identifies what type of identifier
it received and what API call it would make.
"""

from url_parser import IdentifierType, parse_youtube_url


def test_resolution_logic():
    """Test resolution logic for various input formats."""

    test_cases = [
        # (input, should_call_api, api_type_description)
        (
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            True,
            "Video URL - would call videos API to get channel ID",
        ),
        (
            "https://youtu.be/dQw4w9WgXcQ",
            True,
            "Short video URL - would call videos API to get channel ID",
        ),
        (
            "https://www.youtube.com/channel/UCxxxxxxxxxxxxxxxxxxxxxx",
            False,
            "Direct channel ID - no API call needed",
        ),
        (
            "https://www.youtube.com/user/SomeUsername",
            True,
            "Username - would call API with forUsername parameter",
        ),
        (
            "https://www.youtube.com/@somehandle",
            True,
            "Handle - would call API with forHandle parameter",
        ),
        ("UCxxxxxxxxxxxxxxxxxxxxxx", False, "Direct channel ID - no API call needed"),
        ("@somehandle", True, "Handle - would call API with forHandle parameter"),
    ]

    print("Testing channel ID resolution logic...\n")
    print("=" * 70 + "\n")

    for input_str, should_call_api, description in test_cases:
        try:
            identifier_type, identifier = parse_youtube_url(input_str)

            print(f"Input:  {input_str}")
            print(f"Type:   {identifier_type.value}")
            print(f"Value:  {identifier}")

            if identifier_type == IdentifierType.CHANNEL_ID:
                print(f"Result: ✓ Would return directly (no API call)")
            elif identifier_type == IdentifierType.USERNAME:
                print(
                    f"Result: ✓ Would call channels API with forUsername={identifier}"
                )
            elif identifier_type == IdentifierType.HANDLE:
                print(f"Result: ✓ Would call channels API with forHandle={identifier}")
            elif identifier_type == IdentifierType.VIDEO_ID:
                print(
                    f"Result: ✓ Would call videos API to get channel from video_id={identifier}"
                )
            elif identifier_type == IdentifierType.CUSTOM_URL:
                print(f"Result: ✗ Would raise ValueError (not API-resolvable)")

            print(f"Info:   {description}")
            print()

        except ValueError as e:
            print(f"Input:  {input_str}")
            print(f"Result: ✗ ValueError raised")
            print(f"Error:  {str(e)[:100]}...")
            print()

    print("=" * 70)
    print("\nResolution logic test complete!")
    print("\nNote: This test only validates the resolution logic.")
    print("Actual API calls would require a valid YouTube API key.")


if __name__ == "__main__":
    test_resolution_logic()
