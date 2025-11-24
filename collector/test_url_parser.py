"""
Test script for URL parser functionality.

This script tests various YouTube URL formats to ensure they are parsed correctly.
"""

from url_parser import IdentifierType, parse_youtube_url


def test_url_formats():
    """Test various YouTube URL formats."""

    test_cases = [
        # (input, expected_type, expected_identifier)
        (
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            IdentifierType.VIDEO_ID,
            "dQw4w9WgXcQ",
        ),
        (
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s",
            IdentifierType.VIDEO_ID,
            "dQw4w9WgXcQ",
        ),
        ("https://youtu.be/dQw4w9WgXcQ", IdentifierType.VIDEO_ID, "dQw4w9WgXcQ"),
        ("https://youtu.be/dQw4w9WgXcQ?t=42", IdentifierType.VIDEO_ID, "dQw4w9WgXcQ"),
        (
            "https://www.youtube.com/channel/UCxxxxxxxxxxxxxxxxxxxxxx",
            IdentifierType.CHANNEL_ID,
            "UCxxxxxxxxxxxxxxxxxxxxxx",
        ),
        (
            "https://www.youtube.com/user/SomeUsername",
            IdentifierType.USERNAME,
            "SomeUsername",
        ),
        ("https://www.youtube.com/@somehandle", IdentifierType.HANDLE, "somehandle"),
        (
            "https://www.youtube.com/c/CustomName",
            IdentifierType.CUSTOM_URL,
            "CustomName",
        ),
        (
            "UCxxxxxxxxxxxxxxxxxxxxxx",
            IdentifierType.CHANNEL_ID,
            "UCxxxxxxxxxxxxxxxxxxxxxx",
        ),
        ("@somehandle", IdentifierType.HANDLE, "somehandle"),
    ]

    print("Testing URL parser...\n")

    all_passed = True
    for input_str, expected_type, expected_id in test_cases:
        try:
            result_type, result_id = parse_youtube_url(input_str)

            if result_type == expected_type and result_id == expected_id:
                print(f"✓ PASS: {input_str}")
                print(f"    → {result_type.value}: {result_id}\n")
            else:
                print(f"✗ FAIL: {input_str}")
                print(f"    Expected: {expected_type.value}: {expected_id}")
                print(f"    Got:      {result_type.value}: {result_id}\n")
                all_passed = False

        except Exception as e:
            print(f"✗ ERROR: {input_str}")
            print(f"    {e}\n")
            all_passed = False

    # Test invalid format
    print("Testing invalid format (should raise ValueError):")
    try:
        parse_youtube_url("https://example.com/invalid")
        print("✗ FAIL: Should have raised ValueError\n")
        all_passed = False
    except ValueError as e:
        print("✓ PASS: Correctly raised ValueError")
        print(f"    Message: {str(e)[:100]}...\n")

    if all_passed:
        print("\n" + "=" * 50)
        print("All tests passed!")
        print("=" * 50)
    else:
        print("\n" + "=" * 50)
        print("Some tests failed!")
        print("=" * 50)

    return all_passed


if __name__ == "__main__":
    import sys

    success = test_url_formats()
    sys.exit(0 if success else 1)
